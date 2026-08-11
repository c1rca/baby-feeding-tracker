/**
 * Page-object helpers that drive the real, accessible controls.
 *
 * Nothing here injects application state. Fixtures are seeded only through the
 * isolated API (see `acceptance.ts`); everything a caregiver would do is done by
 * clicking and typing what a caregiver sees, so the matrix exercises the
 * shipped bundle rather than a test-only path through it.
 */
import { expect, type Page } from '@playwright/test'

export type Side = 'Left' | 'Right'

// Buttons in the hero action row are matched on their visible text: the primary
// carries an aria-label naming the *suggested* side, which flips with feed
// history, while the label a caregiver reads does not.
const heroButton = (page: Page, text: RegExp) => page.locator('.hero-actions button').filter({ hasText: text }).first()

export const startFeed = async (page: Page, side: Side): Promise<void> => {
  await heroButton(page, new RegExp(`^Start ${side}$`)).click()
  await expect(page.locator('.hero-actions button', { hasText: /Stop & Save Feed/ })).toBeVisible()
}

export const switchSide = async (page: Page, to: Side): Promise<void> => {
  await heroButton(page, new RegExp(`^Switch to ${to}$`)).click()
}

export const pauseFeed = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: /^Pause feed timer$/ }).click()
  await expect(page.getByRole('button', { name: /^Resume feed timer on/ })).toBeVisible()
}

export const resumeFeedFromTransport = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: /^Resume feed timer on/ }).click()
  await expect(page.getByRole('button', { name: /^Pause feed timer$/ })).toBeVisible()
}

export const resumeFeedSide = async (page: Page, side: Side): Promise<void> => {
  await heroButton(page, new RegExp(`^Resume ${side}$`)).click()
}

export const stopAndSaveFeed = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'End feed' }).click()
}

/**
 * Clearing an active feed is a two-tap confirm, so a stray tap cannot discard a
 * feed in progress.
 */
export const clearActiveFeed = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Clear active feed' }).click()
  await page.getByRole('button', { name: 'Confirm clear active feed' }).click()
}

/** The elapsed seconds the hero timer is currently showing. */
export const readTimerSeconds = async (page: Page): Promise<number> => {
  const text = (await page.locator('.timer-value').first().textContent()) ?? ''
  const match = text.match(/(?:(\d+)m\s*)?(\d+)s/)
  if (!match) return 0
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)
}

/** Let the live timer reach an absolute elapsed value. */
export const waitForTimerSeconds = async (page: Page, seconds: number): Promise<void> => {
  await expect.poll(() => readTimerSeconds(page), { message: `timer never reached ${seconds}s`, timeout: 15_000 })
    .toBeGreaterThanOrEqual(seconds)
}

/**
 * Let the timer advance by `seconds` from wherever it is now.
 *
 * Use this after switching or resuming a side. Waiting on the *total* elapsed
 * does not bound the current segment: the app rounds each segment to whole
 * seconds independently (`Math.round((endedAt - startedAt) / 1000)`), so a
 * segment opened at 1.4s and closed when the total hits 2s lasts 600ms and is
 * recorded as **zero**. On the slower mobile profile that happened about one
 * run in three, and it looked exactly like the app dropping a side.
 */
export const waitForTimerToAdvance = async (page: Page, seconds: number): Promise<void> => {
  const from = await readTimerSeconds(page)
  await expect.poll(() => readTimerSeconds(page), {
    message: `timer never advanced ${seconds}s from ${from}s`,
    timeout: 20_000,
  }).toBeGreaterThanOrEqual(from + seconds)
}

export const clickUndo = async (page: Page, label: string): Promise<void> => {
  await page.getByRole('button', { name: label }).click()
}

// --- care launcher ---------------------------------------------------------

export const openLauncher = async (page: Page, label: string): Promise<void> => {
  await page.locator('.care-launcher button').filter({ hasText: new RegExp(`^${label}$`) }).click()
}

export const logStandaloneDiaper = async (page: Page, choice: 'Wet' | 'Stool' | 'Mixed'): Promise<void> => {
  await openLauncher(page, 'Diapers')
  await page.locator('.care-quick-grid button').filter({ hasText: new RegExp(`^${choice}$`) }).click()
}

export const logMedicine = async (page: Page, choice: 'Tylenol' | 'Motrin' | 'Vitamin D'): Promise<void> => {
  await openLauncher(page, 'Medicine')
  await page.locator('.care-quick-grid button').filter({ hasText: new RegExp(`^${choice}$`) }).click()
}

export const logCustomMedicine = async (page: Page, name: string): Promise<void> => {
  await openLauncher(page, 'Medicine')
  await page.getByLabel('Other medicine name').fill(name)
  await page.getByRole('button', { name: 'Log other medicine' }).click()
}

// --- care timers -----------------------------------------------------------

/** Stop & save whichever care timer holds the shared slot (tummy, sleep, custom). */
export const stopCareTimer = async (page: Page, label: string): Promise<void> => {
  await page.getByRole('button', { name: `Stop & save ${label}` }).click()
}

export const pauseCareTimer = async (page: Page, label: string): Promise<void> => {
  await page.getByRole('button', { name: `Pause ${label} timer` }).click()
  await expect(page.getByRole('button', { name: `Resume ${label} timer` })).toBeVisible()
}

export const resumeCareTimer = async (page: Page, label: string): Promise<void> => {
  await page.getByRole('button', { name: `Resume ${label} timer` }).click()
  await expect(page.getByRole('button', { name: `Pause ${label} timer` })).toBeVisible()
}

/** Discarding a running care timer is a two-tap confirm, like the feed. */
export const clearCareTimer = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Clear active timer' }).click()
  await page.getByRole('button', { name: 'Confirm clear active timer' }).click()
}

// --- settings --------------------------------------------------------------

export const openSettings = async (page: Page): Promise<void> => {
  // Three layouts reach the same panel under three different names: the desktop
  // topbar ("Open settings"), the compact header ("Show settings") and the
  // navigation rail ("Settings"). Whichever this viewport renders is the real
  // control, so try each rather than assume a breakpoint.
  for (const name of ['Open settings', 'Show settings', 'Settings']) {
    const control = page.getByRole('button', { name, exact: true })
    if (await control.count() === 0) continue
    if (!(await control.first().isVisible())) continue
    await control.first().click()
    await expect(page.getByRole('button', { name: 'Close settings' })).toBeVisible()
    return
  }
  throw new Error('no settings control was visible in this layout')
}

export const openSettingsTab = async (page: Page, label: string): Promise<void> => {
  await page.getByRole('tab', { name: label }).click()
}

export const closeSettings = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByRole('button', { name: 'Close settings' })).toHaveCount(0)
}

/**
 * Define a caregiver tracker through Settings → Baby.
 *
 * A `duration` goal is what makes a tracker timed, which is what earns it a
 * slot in the care launcher; `once` and `count` trackers are logged by a tap
 * from Today's needs instead.
 */
export const createCustomTracker = async (
  page: Page,
  { name, goal, amount }: { name: string; goal: 'Once' | 'Times' | 'Minutes'; amount?: number },
): Promise<void> => {
  await openSettings(page)
  await openSettingsTab(page, 'Baby')
  await page.getByRole('button', { name: 'Add custom tracker' }).click()
  await page.getByRole('textbox', { name: 'Tracker name' }).fill(name)
  await page.getByRole('group', { name: 'Goal type' }).getByRole('button', { name: goal, exact: true }).click()
  if (amount !== undefined && goal !== 'Once') {
    await page.getByLabel(goal === 'Times' ? 'Times per day' : 'Minutes per day').fill(String(amount))
  }
  await page.getByRole('button', { name: 'Add tracker', exact: true }).click()
  await closeSettings(page)
}

/** The Today's-needs row for a tracker, which is where non-timed ones are logged. */
export const careNeedRow = (page: Page, title: string) => page.locator('.care-need').filter({ has: page.locator('strong', { hasText: new RegExp(`^${title}$`) }) })

// --- timeline --------------------------------------------------------------

/**
 * Timeline rows carry no test ids — deliberately, since adding one would be a
 * production change made purely for the harness. Rows are addressed by the
 * class the app already renders per record kind, and each test resets the
 * candidate first so the row it means is unambiguous.
 */
export const timelineRows = {
  feed: (page: Page) => page.locator('li.timeline-item.timeline-breast, li.timeline-item.timeline-bottle, li.timeline-item.timeline-mixed'),
  diaper: (page: Page) => page.locator('li.timeline-item.timeline-diaper'),
  medicine: (page: Page) => page.locator('li.timeline-item.timeline-medicine'),
  careTimer: (page: Page) => page.locator('li.timeline-item.timeline-tummy'),
  custom: (page: Page) => page.locator('li.timeline-item.timeline-custom'),
}

export type TimelineRow = ReturnType<typeof timelineRows.feed>

/**
 * Widen the timeline past its rolling one-day window.
 *
 * The timeline deliberately shows only the last day until asked for more, so a
 * backdated event is not on screen when it is first saved. Each tap adds a day;
 * the loop stops as soon as the control disappears, which is when everything
 * matching the current filter is shown.
 */
export const revealOlderTimelineEvents = async (page: Page, taps = 6): Promise<void> => {
  const loadMore = page.getByRole('button', { name: 'Load older events' })
  for (let i = 0; i < taps; i++) {
    if (await loadMore.count() === 0) return
    await loadMore.click()
  }
}

export const openRowMenu = async (row: TimelineRow, trigger: string): Promise<void> => {
  await row.scrollIntoViewIfNeeded()
  await row.getByRole('button', { name: trigger }).click()
}

/** Delete is a confirm-then-delete pair inside the row's own menu. */
export const deleteRow = async (row: TimelineRow, trigger: string, deleteLabel: string, confirmLabel: string): Promise<void> => {
  await openRowMenu(row, trigger)
  await row.getByRole('menuitem', { name: deleteLabel }).click()
  await row.getByRole('menuitem', { name: confirmLabel }).click()
}

/** Open a row's inline edit panel through its actions menu. */
export const startRowEdit = async (row: TimelineRow, trigger: string, editLabel: string): Promise<void> => {
  await openRowMenu(row, trigger)
  await row.getByRole('menuitem', { name: editLabel }).click()
}
