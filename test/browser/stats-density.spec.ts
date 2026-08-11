import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const day = 86_400_000

// Thirty days of tummy sessions, most days present but not all, so the chart has
// both valued and empty columns — the mix that exposed the layout bugs.
const tummyFixture = () => {
  const now = Date.now()
  return Array.from({ length: 30 }, (_, i) => {
    const startedAt = now - i * day - 3 * 3_600_000
    const minutes = i % 4 === 0 ? 0 : 8 + (i % 5) * 4
    return minutes === 0 ? null : { id: `density-${i}`, startedAt, endedAt: startedAt + minutes * 60_000, note: '', kind: 'tummy' }
  }).filter(Boolean)
}

// Read-modify-write: a bare PUT carries no updatedAt, which the server reads as
// a stale replay and merges rather than replaces.
const writeState = async (request: Pick<APIRequestContext, 'get' | 'put'>, patch: Record<string, unknown>) => {
  const current = await (await request.get('/api/state')).json()
  expect((await request.put('/api/state', { data: { ...current, ...patch } })).ok()).toBeTruthy()
}

const measure = (page: Page) => page.evaluate(() => {
  const list = document.querySelector('.tummy-week-bars .interactive-day-bar-list')
  if (!list) return null
  const days = [...list.querySelectorAll('.stat-bar-day')]
  // The selected bar is deliberately lifted 2px as hover feedback, so it is
  // excluded from the baseline comparison — the question is whether the *rest*
  // sit level with each other.
  const unselected = days.filter((d) => !d.classList.contains('is-selected'))
  const trackTop = (d: Element) => Math.round(d.querySelector('.stat-bar-track')!.getBoundingClientRect().top)
  const labels = days
    .map((d) => d.querySelector('.stat-bar-label'))
    .filter((el): el is Element => !!el && getComputedStyle(el).visibility !== 'hidden' && !!el.textContent?.trim())
    .map((el) => el.getBoundingClientRect())
  let labelCollisions = 0
  for (let i = 1; i < labels.length; i += 1) if (labels[i].left < labels[i - 1].right - 0.5) labelCollisions += 1
  return {
    count: days.length,
    columnWidth: Math.round(days[0]?.getBoundingClientRect().width ?? 0),
    distinctTrackTops: new Set(unselected.map(trackTop)).size,
    distinctHeights: new Set(days.map((d) => Math.round(d.getBoundingClientRect().height))).size,
    labelCollisions,
    visibleLabels: labels.length,
  }
})

test.describe('stats day-bar density', () => {
  test.beforeEach(async ({ page, request }) => {
    await writeState(request, { tummyTimes: tummyFixture(), tummySession: null, session: null, pumpSession: null })
    await page.addInitScript(() => localStorage.setItem('baby-feeding-tracker:v1:live-sync-enabled', 'off'))
    await page.goto('/')
    await page.getByRole('button', { name: 'Insights' }).click()
  })

  // Past 14 days the card switches instrument: thirty bars a couple of pixels
  // apart merge into one block, so the same series is drawn as a trend line
  // with gridlines and an axis.
  test('the tummy chart becomes a trend line over 30 days', async ({ page }) => {
    await page.getByRole('button', { name: '30 days' }).click()
    const chart = page.locator('.tummy-week-bars, .range-trend-chart--tummy')
    await expect(chart).toBeVisible()
    await expect(page.locator('.tummy-week-bars .interactive-day-bar-list')).toHaveCount(0)
    const trend = page.locator('.range-trend-chart--tummy')
    await expect(trend).toBeVisible()
    // A readable long range needs an amplitude reference and a date axis.
    expect(await trend.locator('.range-y-axis span').count(), 'no y-axis labels').toBeGreaterThan(1)
    expect(await trend.locator('.range-axis span').count(), 'no date axis').toBeGreaterThan(1)
    expect(await trend.locator('.range-point').count(), 'no plotted points').toBeGreaterThan(20)
  })


  // The hover targets were a fixed 38px wide and tracked the line's y as well.
  // At thirty points, 17px apart, that left 29 overlapping pairs, so the
  // selection jumped to whichever happened to be stacked on top — and each
  // carried a rounded translucent hover fill that read as a stray circle
  // following the cursor.
  test('trend-chart hover targets tile without overlapping and show no puck', async ({ page }) => {
    await page.getByRole('button', { name: '30 days' }).click()
    const chart = page.locator('.range-trend-chart').first()
    await expect(chart).toBeVisible()

    const geometry = await page.evaluate(() => {
      // Scope to one chart: the page renders several, and comparing boxes
      // across them reads each boundary as an overlap.
      const chart = document.querySelector('.range-trend-chart')
      const controls = [...chart.querySelectorAll('.range-point-control')]
      const boxes = controls.map((c) => c.getBoundingClientRect())
      let overlaps = 0
      for (let i = 1; i < boxes.length; i += 1) if (boxes[i].left < boxes[i - 1].right - 0.5) overlaps += 1
      const style = getComputedStyle(controls[0])
      const plot = chart.querySelector('.range-plot').getBoundingClientRect()
      return {
        count: controls.length,
        overlaps,
        radius: style.borderRadius,
        background: style.backgroundColor,
        fullHeight: Math.abs(boxes[0].height - plot.height) < 2,
      }
    })

    expect(geometry.count).toBeGreaterThan(20)
    expect(geometry.overlaps, `${geometry.overlaps} hover targets overlap`).toBe(0)
    expect(geometry.radius, 'hover target is still a rounded puck').toBe('0px')
    expect(geometry.background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    expect(geometry.fullHeight, 'hover target does not span the plot height').toBe(true)
  })

  for (const range of ['7 days', '14 days']) {
    test(`the tummy chart stays legible over ${range}`, async ({ page }) => {
      await page.getByRole('button', { name: range }).click()
      await expect.poll(async () => (await measure(page))?.count ?? 0).toBeGreaterThan(0)
      const m = (await measure(page))!

      // Every bar sits on the same baseline. When the per-bar value wrapped to a
      // second line, only the columns carrying a number grew taller and their
      // tracks were pushed up — the "bumped up" bars.
      expect(m.distinctTrackTops, `bar tracks sit at ${m.distinctTrackTops} different heights over ${range}`).toBe(1)
      expect(m.distinctHeights, `bar buttons have ${m.distinctHeights} different heights over ${range}`).toBe(1)

      // Columns must keep real width. The 16px gutter used to claim the whole
      // row at thirty columns and collapse them to a single pixel. What counts
      // as "real" depends on how many have to fit: thirty days on a phone is a
      // shape rather than thirty readable days, and that is fine — a collapse
      // to nothing is not.
      const floor = m.count > 20 ? 6 : 12
      expect(m.columnWidth, `columns collapsed to ${m.columnWidth}px across ${m.count} days`).toBeGreaterThanOrEqual(floor)

      // Labels thin out rather than overprinting each other.
      expect(m.labelCollisions, `${m.labelCollisions} labels overlap over ${range}`).toBe(0)
      expect(m.visibleLabels, `no labels visible over ${range}`).toBeGreaterThan(1)
    })
  }
})
