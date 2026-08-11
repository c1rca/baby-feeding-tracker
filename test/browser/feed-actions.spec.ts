import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const minute = 60_000

// A feed paused 72 minutes in: the value reads double digits and all three
// actions are present — resume either side, or stop and save.
const pausedFeed = () => {
  const startedAt = Date.now() - 72 * minute
  return { id: 'actions-fixture', startedAt, activeSide: null, segmentStart: null, segments: [{ side: 'left', startedAt, endedAt: startedAt + 40 * minute }], bottleOunces: 0, note: '', diaperKinds: [] }
}

const writeState = async (request: Pick<APIRequestContext, 'get' | 'put'>, patch: Record<string, unknown>) => {
  const current = await (await request.get('/api/state')).json()
  expect((await request.put('/api/state', { data: { ...current, ...patch } })).ok()).toBeTruthy()
}

const rows = (page: Page) => page.evaluate(() => {
  const row = document.querySelector('.hero-actions')
  if (!row) return null
  const buttons = [...row.querySelectorAll('button')]
  const box = (b: Element) => b.getBoundingClientRect()
  const actions = buttons.filter((b) => !b.classList.contains('active-clear-link'))
  const clear = buttons.find((b) => b.classList.contains('active-clear-link'))
  return {
    labels: buttons.map((b) => (b.textContent || '').trim()),
    actionRows: new Set(actions.map((b) => Math.round(box(b).top))).size,
    clearBelowActions: clear ? Math.round(box(clear).top) > Math.max(...actions.map((b) => Math.round(box(b).top))) : null,
    overflowsPanel: actions.some((b) => box(b).right > box(row).right + 0.5),
  }
})

test.describe('feed actions row', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('baby-feeding-tracker:v1:live-sync-enabled', 'off'))
  })

  test.afterEach(async ({ request }) => {
    await writeState(request, { session: null, tummySession: null, pumpSession: null })
  })

  test('a paused feed keeps both resumes and stop-and-save on one row', async ({ page, request }) => {
    await page.goto('/')
    await page.waitForTimeout(1200)
    await writeState(request, { session: pausedFeed() })
    await page.reload()
    await expect(page.getByRole('button', { name: /Resume Left/i })).toBeVisible()

    const m = (await rows(page))!
    expect(m.labels.some((l) => /Resume Left/i.test(l))).toBe(true)
    expect(m.labels.some((l) => /Resume Right/i.test(l))).toBe(true)
    expect(m.labels.some((l) => /Stop & Save Feed/i.test(l))).toBe(true)

    // The three actions share one row wherever there is room for them. They used
    // to total more than the panel's width and stop-and-save dropped beside the
    // clear link. A phone genuinely cannot fit three at a legible size, so the
    // contract there is only that nothing overflows.
    if ((page.viewportSize()?.width ?? 0) >= 900) {
      expect(m.actionRows, 'the feed actions split across rows').toBe(1)
    }
    expect(m.overflowsPanel, 'an action overflowed the hero panel').toBe(false)
    // The clear link keeps its own row underneath, as it always has.
    expect(m.clearBelowActions, 'clear active did not sit below the actions').toBe(true)
  })

  test('a running feed keeps switch and stop-and-save on one row', async ({ page, request }) => {
    await page.goto('/')
    await page.waitForTimeout(1200)
    await writeState(request, { session: { ...pausedFeed(), activeSide: 'left' } })
    await page.reload()
    await expect(page.getByRole('button', { name: /Switch to/i })).toBeVisible()

    const m = (await rows(page))!
    if ((page.viewportSize()?.width ?? 0) >= 900) {
      expect(m.actionRows, 'the feed actions split across rows').toBe(1)
    }
    expect(m.overflowsPanel, 'an action overflowed the hero panel').toBe(false)
    expect(m.clearBelowActions, 'clear active did not sit below the actions').toBe(true)
  })
})
