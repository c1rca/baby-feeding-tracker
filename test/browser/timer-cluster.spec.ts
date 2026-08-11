import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const minute = 60_000

// Widths that matter: every desktop size where the hero panel sits beside the
// sidebar and the side column (the panel stays ~495px wide there no matter how
// wide the window gets), the tablet sizes where the side column drops away, and
// the phone sizes where the label cannot share a line with the value at all.
const WIDTHS = [1920, 1600, 1440, 1366, 1280, 1200, 1120, 1024, 960, 900, 820, 700, 600, 500, 460, 430, 390, 375, 360, 320]

const baseState = () => ({
  entries: [],
  diapers: [],
  medicines: [],
  tummyTimes: [],
  pumpEvents: [],
  pumpSession: null,
  tummySession: null,
  tummyGoalMinutes: 20,
  growthMeasurements: [],
  babyDob: '2026-01-01',
  session: null,
  theme: 'light' as const,
})

// A tummy session that started 15 minutes ago, so the value is always the
// widest the formatter produces: two digits either side ("15m 42s"). Single
// digit minutes are a character narrower and never reproduced the collision.
const runningTummySession = () => {
  const startedAt = Date.now() - 15 * minute
  return { ...baseState(), tummySession: { id: 'timer-fixture', startedAt, note: '', kind: 'tummy', runningStartedAt: startedAt, elapsedSeconds: 0 } }
}

const runningFeedSession = () => {
  const startedAt = Date.now() - 72 * minute
  return { ...baseState(), session: { id: 'feed-fixture', startedAt, activeSide: 'left', segmentStart: startedAt, segments: [], bottleOunces: 0, note: '' } }
}

type Box = { left: number; right: number; top: number; bottom: number; width: number; height: number }
type Measurement = {
  label: Box | null
  value: Box
  transport: Box | null
  cluster: Box
  text: string
  lineBoxHeight: number
}

const measure = (page: Page) => page.evaluate((): Measurement | null => {
  const box = (selector: string): Box | null => {
    const element = document.querySelector(selector)
    if (!element) return null
    const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
    return { left, right, top, bottom, width, height }
  }
  const value = document.querySelector('.timer')
  const cluster = box('.timer-cluster')
  if (!value || !cluster) return null
  const styles = getComputedStyle(value)
  const fontSize = parseFloat(styles.fontSize)
  return {
    label: box('.timer-mode-pill'),
    value: box('.timer')!,
    transport: box('.transport-toggle'),
    cluster,
    text: value.textContent ?? '',
    lineBoxHeight: styles.lineHeight === 'normal' ? fontSize * 1.2 : parseFloat(styles.lineHeight),
  }
})

// A stacked layout puts the label on its own row, where the horizontal ranges
// legitimately cross. Only a genuine 2-D intersection is an overlap.
const overlaps = (a: Box | null, b: Box | null) =>
  !!a && !!b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5

// Every write here has to be based on the state the server currently holds.
// A bare PUT carries no updatedAt, so the server reads it as a stale replay and
// takes the conservative merge path: it protects a running session and ignores
// an incoming one. Read-modify-write makes the fixture authoritative, whatever
// an earlier run left behind.
const writeState = async (request: Pick<APIRequestContext, 'get' | 'put'>, patch: Record<string, unknown>) => {
  const current = await (await request.get('/api/state')).json()
  expect((await request.put('/api/state', { data: { ...current, ...patch } })).ok()).toBeTruthy()
}

const clearSessions = (request: Pick<APIRequestContext, 'get' | 'put'>) =>
  writeState(request, { session: null, tummySession: null, pumpSession: null })

test.describe('hero timer cluster', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('baby-feeding-tracker:v1:live-sync-enabled', 'off'))
  })

  // These fixtures leave a session running, which changes what the Track page
  // renders. Specs share one dev server, so hand it back the way we found it.
  test.afterEach(async ({ request }) => {
    await clearSessions(request)
  })

  test('the care timer keeps label, value and transport on one row', async ({ page, request }) => {
    // Seed after the first load, not before: this build reconciles local and
    // server state on startup, so a fresh client can push its empty session
    // over a session seeded ahead of the page. Clear first as well — the server
    // deliberately preserves a running session through a merge, so a stale one
    // left by an earlier run would survive and be measured instead.
    await clearSessions(request)
    await page.goto('/')
    await page.waitForTimeout(1500)
    await writeState(request, runningTummySession())
    await page.reload()
    await expect(page.locator('.timer-mode-pill')).toBeVisible()

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      // Let the container query and the clamp settle before measuring.
      await expect.poll(async () => (await measure(page))?.value.width ?? 0).toBeGreaterThan(0)
      const m = await measure(page)
      expect(m, `no timer rendered at ${width}px`).not.toBeNull()
      const { label, value, transport, cluster, text, lineBoxHeight } = m!

      expect(text, `at ${width}px the fixture should render a two-digit value`).toMatch(/^\d{2}m \d{2}s$/)
      // The label, the value and the transport control share one row at every
      // width. Upstream stacks the label above on narrow screens; this build
      // trims the label instead and keeps the row intact.
      const sameRow = (a: Box | null, b: Box | null) => !!a && !!b && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
      expect(sameRow(label, value), `label left its row at ${width}px`).toBe(true)
      expect(sameRow(value, transport), `transport left its row at ${width}px`).toBe(true)
      expect(overlaps(label, value), `label overlaps the value at ${width}px`).toBe(false)
      expect(overlaps(value, transport), `value overlaps the transport control at ${width}px`).toBe(false)
      expect(Math.round(value.height / lineBoxHeight), `the value wrapped onto more than one line at ${width}px`).toBe(1)
      expect(value.left, `the value overflows its container at ${width}px`).toBeGreaterThanOrEqual(cluster.left - 0.5)
      expect(value.right, `the value overflows its container at ${width}px`).toBeLessThanOrEqual(cluster.right + 0.5)
    }
  })

  test('the feed timer stays on one line inside its container', async ({ page, request }) => {
    await clearSessions(request)
    await page.goto('/')
    await page.waitForTimeout(1500)
    await writeState(request, runningFeedSession())
    await page.reload()
    await expect(page.locator('.timer')).toBeVisible()

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(async () => (await measure(page))?.value.width ?? 0).toBeGreaterThan(0)
      const { value, transport, cluster, lineBoxHeight } = (await measure(page))!

      expect(overlaps(value, transport), `value overlaps the transport control at ${width}px`).toBe(false)
      expect(Math.round(value.height / lineBoxHeight), `the value wrapped onto more than one line at ${width}px`).toBe(1)
      expect(value.right, `the value overflows its container at ${width}px`).toBeLessThanOrEqual(cluster.right + 0.5)
    }
  })
})
