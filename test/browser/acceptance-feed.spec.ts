/**
 * Release acceptance matrix — section A: breast feeds and bottles.
 *
 * Every row drives the shipped controls and then asserts what actually reached
 * the isolated candidate's API, because a record that renders but never
 * persists is the failure mode this gate exists to catch.
 */
import { expect, test, type Page } from '@playwright/test'
import {
  apiCollection, expectExactlyOnce, isIsolatedTarget, NOT_ISOLATED_REASON,
  openAppPage, resetApiState, resetSharedCandidate, waitForApiState,
} from './helpers/acceptance'
import {
  clearActiveFeed, clickUndo, openLauncher, pauseFeed, resumeFeedSide, startFeed,
  stopAndSaveFeed, switchSide, timelineRows, deleteRow, startRowEdit, waitForTimerSeconds, waitForTimerToAdvance,
} from './helpers/careUi'

test.describe.configure({ mode: 'serial' })

/** Local wall-clock helpers evaluated in the browser, so locale and timezone match the app. */
const browserClock = (page: Page, minutesAgo: number) => page.evaluate((minutes) => {
  const date = new Date(Date.now() - minutes * 60_000)
  date.setSeconds(0, 0)
  return { text: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), ms: date.getTime() }
}, minutesAgo)

const browserDateInput = (page: Page, daysAgo: number) => page.evaluate((days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}, daysAgo)

test.describe('acceptance: breast feed', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL), NOT_ISOLATED_REASON)

  // Specs share one candidate; leave it empty for whatever runs next.
  test.afterAll(resetSharedCandidate)

  test('Start Left then Stop & Save creates exactly one breast entry', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startFeed(page, 'Left')
    await waitForTimerSeconds(page, 1)
    await stopAndSaveFeed(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the saved feed never reached the API')
    const entries = apiCollection(state, 'entries')
    const entry = expectExactlyOnce(entries, entries[0].id, 'API entries')
    expect(entry.type).toBe('breast')
    expect(entry.leftSeconds as number).toBeGreaterThan(0)
    expect(entry.rightSeconds).toBe(0)

    // Saving a feed is not an undoable action in this build: the toast confirms
    // and offers nothing to reverse. Removing a saved feed goes through the
    // timeline's delete + undo, covered below.
    await expect(page.locator('.toast')).toContainText('Feed saved')
    await expect(page.locator('.toast button')).toHaveCount(0)

    await context.close()
  })

  test('Start Right then Stop & Save records the right side only', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startFeed(page, 'Right')
    await waitForTimerSeconds(page, 1)
    await stopAndSaveFeed(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the right-side feed never reached the API')
    const entry = apiCollection(state, 'entries')[0]
    expect(entry.rightSeconds as number).toBeGreaterThan(0)
    expect(entry.leftSeconds).toBe(0)

    await context.close()
  })

  test('switch side, pause and resume accumulate both sides into one entry', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startFeed(page, 'Left')
    await waitForTimerSeconds(page, 1)
    await switchSide(page, 'Right')
    // Advance from the switch, not to an absolute total: each segment is
    // rounded to whole seconds on its own, so a sub-second right segment is
    // recorded as zero and reads as the app having dropped the side.
    await waitForTimerToAdvance(page, 2)
    // Pausing closes the running segment; resuming opens a new one on the side
    // chosen from the hero actions, so both sides must survive the round trip.
    await pauseFeed(page)
    await resumeFeedSide(page, 'Left')
    await waitForTimerToAdvance(page, 2)
    await stopAndSaveFeed(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the multi-segment feed never reached the API')
    const entries = apiCollection(state, 'entries')
    const entry = expectExactlyOnce(entries, entries[0].id, 'API entries')
    expect(entry.leftSeconds as number, 'left segments were dropped').toBeGreaterThan(0)
    expect(entry.rightSeconds as number, 'the right segment was dropped').toBeGreaterThan(0)

    await context.close()
  })

  test('clear active feed discards it and undo brings the session back', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startFeed(page, 'Left')
    await waitForTimerSeconds(page, 1)
    await clearActiveFeed(page)

    // Cancel semantics: no entry is created by clearing.
    await expect(page.locator('.hero-actions button').filter({ hasText: /Stop & Save Feed/ })).toHaveCount(0)
    await expect(page.locator('.toast')).toContainText('Active feed cleared')

    await clickUndo(page, 'Undo clear active feed')
    await expect(page.locator('.hero-actions button').filter({ hasText: /Stop & Save Feed/ })).toBeVisible()

    // The restored session is still an active feed, not a saved entry.
    const state = await waitForApiState(request, (s) => s.session !== null, 'the restored session never reached the API')
    expect(apiCollection(state, 'entries')).toHaveLength(0)

    await context.close()
  })

  test('an explicit start clock time backdates the saved feed', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const target = await browserClock(page, 40)
    await page.getByRole('button', { name: 'Adjust start time' }).click()
    await page.getByRole('tab', { name: 'Clock time' }).click()
    await page.getByLabel('Session start time').fill(target.text)
    await startFeed(page, 'Left')
    await stopAndSaveFeed(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the backdated feed never reached the API')
    const entry = apiCollection(state, 'entries')[0]
    expect(entry.startedAt, `start clock ${target.text} was not honoured`).toBe(target.ms)
    expect(entry.leftSeconds as number, 'the backdated span was not counted').toBeGreaterThanOrEqual(2340)

    await context.close()
  })

  test('the minutes-ago start option backdates the saved feed', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await page.getByRole('button', { name: 'Adjust start time' }).click()
    await page.getByRole('tab', { name: 'Minutes ago' }).click()
    await page.getByLabel('Start minutes ago').fill('25')
    await expect(page.locator('.start-offset-summary')).toHaveText('25 min ago')
    const before = Date.now()
    await startFeed(page, 'Left')
    await stopAndSaveFeed(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the minutes-ago feed never reached the API')
    const entry = apiCollection(state, 'entries')[0]
    const expected = before - 25 * 60_000
    expect(Math.abs((entry.startedAt as number) - expected), 'the 25-minute offset was not applied').toBeLessThan(10_000)

    await context.close()
  })

  test('a bottle amount and note attach to the active feed and save as one mixed entry', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startFeed(page, 'Left')
    await waitForTimerSeconds(page, 1)

    await openLauncher(page, 'Bottle')
    await page.getByRole('button', { name: 'Log bottle' }).click()
    await expect(page.locator('.toast')).toContainText('Bottle added to active feed')

    await page.getByLabel('Note for current feed').fill('acceptance note')
    await stopAndSaveFeed(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the mixed feed never reached the API')
    const entries = apiCollection(state, 'entries')
    const entry = expectExactlyOnce(entries, entries[0].id, 'API entries')
    expect(entry.type, 'a feed with both nursing time and a bottle should save as mixed').toBe('mixed')
    expect(entry.bottleOunces as number).toBeGreaterThan(0)
    expect(entry.note).toBe('acceptance note')

    await context.close()
  })

  test('closing the bottle sheet creates nothing', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await openLauncher(page, 'Bottle')
    await expect(page.getByRole('button', { name: 'Log bottle' })).toBeVisible()
    await page.getByRole('button', { name: 'Close bottle log' }).click()
    await expect(page.getByRole('button', { name: 'Log bottle' })).toHaveCount(0)

    // Give the debounced whole-state PUT a chance to fire before asserting that
    // nothing was written, so this cannot pass merely by racing the sync.
    await page.waitForTimeout(1500)
    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 0, 'cancelling the bottle sheet created an entry')
    expect(apiCollection(state, 'entries')).toHaveLength(0)

    await context.close()
  })

  test('a quick bottle with no active feed saves a bottle entry', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await openLauncher(page, 'Bottle')
    await page.getByRole('button', { name: 'Log bottle' }).click()

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the quick bottle never reached the API')
    const entry = apiCollection(state, 'entries')[0]
    expect(entry.type).toBe('bottle')
    expect(entry.bottleOunces as number).toBeGreaterThan(0)
    expect(entry.leftSeconds).toBe(0)

    await context.close()
  })

  test('editing a saved feed keeps its id and changes only the edited fields', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startFeed(page, 'Left')
    await waitForTimerSeconds(page, 1)
    await stopAndSaveFeed(page)

    const created = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the feed to edit never reached the API')
    const original = apiCollection(created, 'entries')[0]
    const originalId = original.id
    const yesterday = await browserDateInput(page, 1)

    const row = timelineRows.feed(page).first()
    await startRowEdit(row, 'Entry actions', 'Edit entry')
    const panel = row.locator('.edit-panel')
    await panel.getByLabel('Entry date').fill(yesterday)
    await panel.getByLabel('Left minutes').fill('12')
    await panel.getByLabel('Right minutes').fill('7')
    await panel.getByLabel(/^Bottle/).fill('3')
    await panel.getByLabel('Note').fill('edited note')
    // Feed-attached diaper kinds are editable here even though the shipped hero
    // has no control for attaching one while the feed is running.
    await panel.getByRole('button', { name: 'Add wet diaper from entry' }).click()
    await panel.getByRole('button', { name: 'Add stool diaper from entry' }).click()
    await panel.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('.toast')).toContainText('Entry updated')

    const edited = await waitForApiState(
      request,
      (s) => apiCollection(s, 'entries').some((item) => item.id === originalId && item.leftSeconds === 720),
      'the feed edit never reached the API',
    )
    const entries = apiCollection(edited, 'entries')
    expect(entries, 'editing must not fork a second entry').toHaveLength(1)
    const entry = expectExactlyOnce(entries, originalId, 'API entries after edit')
    expect(entry.leftSeconds).toBe(720)
    expect(entry.rightSeconds).toBe(420)
    expect(entry.bottleOunces).toBe(3)
    expect(entry.note).toBe('edited note')
    expect(entry.diaperKinds).toEqual(['wet', 'stool'])
    expect(entry.type, 'nursing time plus a bottle is a mixed feed').toBe('mixed')
    // The date moved back a day; the clock time and duration are preserved.
    const startedAt = new Date(entry.startedAt as number)
    const expectedDay = yesterday.split('-').map(Number)
    expect([startedAt.getFullYear(), startedAt.getMonth() + 1, startedAt.getDate()]).toEqual(expectedDay)
    expect((entry.endedAt as number) - (entry.startedAt as number)).toBe((original.endedAt as number) - (original.startedAt as number))
    expect(entry.sourceSessionId, 'the edit must not rewrite provenance').toBe(original.sourceSessionId)

    await context.close()
  })

  test('deleting a saved feed removes it and undo restores the same id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startFeed(page, 'Left')
    await waitForTimerSeconds(page, 1)
    await stopAndSaveFeed(page)

    const created = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the feed to delete never reached the API')
    const originalId = apiCollection(created, 'entries')[0].id

    await deleteRow(timelineRows.feed(page).first(), 'Entry actions', 'Delete entry', 'Confirm delete entry')
    await expect(timelineRows.feed(page)).toHaveCount(0)
    // A delete is a real server-side tombstone, not just a local omission.
    await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 0, 'the delete never reached the API')

    await clickUndo(page, 'Undo delete')
    await expect(timelineRows.feed(page)).toHaveCount(1)

    const restored = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the restored feed never reached the API')
    const entries = apiCollection(restored, 'entries')
    expect(expectExactlyOnce(entries, originalId, 'API entries after undo').id, 'undo must restore the same record, not a copy').toBe(originalId)

    await context.close()
  })
})
