/**
 * Release acceptance matrix — section C: tummy time, sleep and custom timers.
 *
 * All three share one care-timer slot in the hero, which is what keeps
 * "one timer at a time" true across a reload. A caregiver-defined timer saves
 * as a custom event rather than a tummy-time row, so both destinations are
 * asserted against the API.
 */
import { expect, test } from '@playwright/test'
import {
  apiCollection, expectExactlyOnce, isIsolatedTarget, NOT_ISOLATED_REASON,
  openAppPage, resetApiState, resetSharedCandidate, waitForApiState,
} from './helpers/acceptance'
import {
  careNeedRow, clearCareTimer, clickUndo, closeSettings, createCustomTracker, deleteRow,
  openLauncher, openSettings, openSettingsTab, pauseCareTimer, resumeCareTimer, startRowEdit,
  stopCareTimer, timelineRows, waitForTimerSeconds,
} from './helpers/careUi'

test.describe.configure({ mode: 'serial' })

const startTummyTimer = async (page: Parameters<typeof openLauncher>[0]) => {
  await openLauncher(page, 'Tummy')
  await page.getByRole('button', { name: 'Start live timer' }).click()
}

// Preset tiles read "5 minutes", "15 minutes"; an exact name keeps 5 from also
// matching 15.
const logTummyPreset = async (page: Parameters<typeof openLauncher>[0], minutes: number) => {
  await openLauncher(page, 'Tummy')
  await page.getByRole('button', { name: `${minutes} minutes`, exact: true }).click()
}

test.describe('acceptance: care timers', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL), NOT_ISOLATED_REASON)

  // Specs share one candidate; leave it empty for whatever runs next.
  test.afterAll(resetSharedCandidate)

  test('tummy time start, pause, resume and stop save exactly one record', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startTummyTimer(page)
    await waitForTimerSeconds(page, 1)
    // A paused span must not be counted, and resuming must not restart the clock.
    await pauseCareTimer(page, 'Tummy Time')
    await resumeCareTimer(page, 'Tummy Time')
    await waitForTimerSeconds(page, 2)
    await stopCareTimer(page, 'Tummy Time')

    const state = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the tummy time never reached the API')
    const records = apiCollection(state, 'tummyTimes')
    const record = expectExactlyOnce(records, records[0].id, 'API tummyTimes')
    expect(record.kind ?? 'tummy').toBe('tummy')
    expect((record.endedAt as number) - (record.startedAt as number)).toBeGreaterThan(0)

    await context.close()
  })

  /**
   * Regression: resuming while the pause's write was still in flight used to
   * undo itself a second later.
   *
   * The racing write made the client drop the revision it knew, so the replay
   * carrying the resume arrived looking stale — and the server's stale path
   * keeps its own session and discards the client's. The response was then
   * adopted and the timer visibly snapped back to paused. Holding the response
   * open reproduces on demand what a slow connection does by chance.
   */
  test('resuming while a write is in flight is not reverted when the response lands', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    let holdNextPut = false
    await page.route('**/api/state', async (route) => {
      if (route.request().method() === 'PUT' && holdNextPut) {
        holdNextPut = false
        await new Promise((resolve) => setTimeout(resolve, 2500))
      }
      await route.continue()
    })

    await startTummyTimer(page)
    await waitForTimerSeconds(page, 1)
    await page.waitForTimeout(1800) // let the start write settle

    holdNextPut = true
    await pauseCareTimer(page, 'Tummy Time')
    await page.waitForTimeout(900) // the pause write is now open and held
    await resumeCareTimer(page, 'Tummy Time')

    // Once the held response and its replay have both landed, the resume must
    // still stand — on screen and on the server.
    await page.waitForTimeout(5000)
    await expect(page.getByRole('button', { name: 'Pause Tummy Time timer' }), 'the resume was reverted in the UI').toBeVisible()
    const state = await waitForApiState(
      request,
      (s) => Boolean((s.tummySession as Record<string, unknown> | null)?.runningStartedAt),
      'the resumed timer never reached the API',
    )
    expect((state.tummySession as Record<string, unknown>).runningStartedAt).toBeTruthy()

    await context.close()
  })

  test('sleep starts from the launcher and saves as a sleep record', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await openLauncher(page, 'Sleep')
    await waitForTimerSeconds(page, 1)
    await stopCareTimer(page, 'Sleep')

    const state = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the sleep never reached the API')
    const record = apiCollection(state, 'tummyTimes')[0]
    expect(record.kind, 'sleep must not be filed as tummy time').toBe('sleep')

    await context.close()
  })

  test('clearing a running care timer creates no record', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startTummyTimer(page)
    await waitForTimerSeconds(page, 1)
    await clearCareTimer(page)
    await expect(page.getByRole('button', { name: 'Stop & save Tummy Time' })).toHaveCount(0)

    await page.waitForTimeout(1500)
    const state = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 0, 'clearing the timer still saved a record')
    expect(apiCollection(state, 'tummyTimes')).toHaveLength(0)
    expect(state.tummySession, 'the cleared session must not linger on the server').toBeNull()

    await context.close()
  })

  test('undoing a saved tummy time removes it everywhere', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await startTummyTimer(page)
    await waitForTimerSeconds(page, 1)
    await stopCareTimer(page, 'Tummy Time')
    await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the tummy time to undo never reached the API')

    await clickUndo(page, 'Undo Tummy Time log')
    await expect(timelineRows.careTimer(page)).toHaveCount(0)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 0, 'the undone tummy time was still on the server')
    expect(apiCollection(state, 'tummyTimes')).toHaveLength(0)

    await context.close()
  })

  test('a tummy time preset saves the chosen duration', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logTummyPreset(page, 15)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the preset tummy time never reached the API')
    const record = apiCollection(state, 'tummyTimes')[0]
    expect(Math.round(((record.endedAt as number) - (record.startedAt as number)) / 60_000)).toBe(15)

    await context.close()
  })

  test('editing a saved tummy time changes start, end and note without changing its id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logTummyPreset(page, 20)
    const created = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the tummy time to edit never reached the API')
    const originalId = apiCollection(created, 'tummyTimes')[0].id

    // Times are typed the way the app renders them, in this browser's locale.
    const times = await page.evaluate(() => {
      const start = new Date(Date.now() - 90 * 60_000)
      start.setSeconds(0, 0)
      const end = new Date(start.getTime() + 35 * 60_000)
      const fmt = (date: Date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      return { start: fmt(start), end: fmt(end), startMs: start.getTime(), endMs: end.getTime() }
    })

    const row = timelineRows.careTimer(page).first()
    await startRowEdit(row, 'Tummy Time actions', 'Edit Tummy Time')
    await row.getByLabel('Tummy Time start time').fill(times.start)
    await row.getByLabel('Tummy Time end time').fill(times.end)
    await row.getByLabel('Tummy Time note').fill('edited care note')
    await row.getByRole('button', { name: 'Save Tummy Time' }).click()
    await expect(page.locator('.toast')).toContainText('Tummy Time updated')

    const edited = await waitForApiState(
      request,
      (s) => apiCollection(s, 'tummyTimes').some((item) => item.id === originalId && item.note === 'edited care note'),
      'the tummy time edit never reached the API',
    )
    const records = apiCollection(edited, 'tummyTimes')
    expect(records, 'editing must not fork a second record').toHaveLength(1)
    const record = expectExactlyOnce(records, originalId, 'API tummyTimes after edit')
    expect(record.startedAt).toBe(times.startMs)
    expect(record.endedAt).toBe(times.endMs)
    expect(record.note).toBe('edited care note')

    await context.close()
  })

  test('an end time before the start is rejected and leaves the record intact', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logTummyPreset(page, 10)
    const created = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the tummy time never reached the API')
    const original = apiCollection(created, 'tummyTimes')[0]

    const row = timelineRows.careTimer(page).first()
    await startRowEdit(row, 'Tummy Time actions', 'Edit Tummy Time')
    await row.getByLabel('Tummy Time start time').fill('not a time')
    await row.getByRole('button', { name: 'Save Tummy Time' }).click()
    await expect(page.locator('.toast')).toContainText('Enter valid Tummy Time times')

    const state = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'a rejected edit lost the record')
    const record = expectExactlyOnce(apiCollection(state, 'tummyTimes'), original.id, 'API tummyTimes')
    expect(record.startedAt, 'a rejected edit must not mutate the record').toBe(original.startedAt)

    await context.close()
  })

  test('editing a sleep record changes its date', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await openLauncher(page, 'Sleep')
    await waitForTimerSeconds(page, 1)
    await stopCareTimer(page, 'Sleep')
    const created = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the sleep to edit never reached the API')
    const originalId = apiCollection(created, 'tummyTimes')[0].id

    const yesterday = await page.evaluate(() => {
      const date = new Date()
      date.setDate(date.getDate() - 1)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })

    const row = timelineRows.careTimer(page).first()
    await startRowEdit(row, 'Tummy Time actions', 'Edit Tummy Time')
    await row.getByLabel('Sleep date').fill(yesterday)
    await row.getByRole('button', { name: 'Save Tummy Time' }).click()
    await expect(page.locator('.toast')).toContainText('Sleep updated')

    const edited = await waitForApiState(
      request,
      (s) => apiCollection(s, 'tummyTimes').some((item) => new Date(item.startedAt as number).getDate() === Number(yesterday.split('-')[2])),
      'the sleep date edit never reached the API',
    )
    const record = expectExactlyOnce(apiCollection(edited, 'tummyTimes'), originalId, 'API tummyTimes after edit')
    const startedAt = new Date(record.startedAt as number)
    expect([startedAt.getFullYear(), startedAt.getMonth() + 1, startedAt.getDate()]).toEqual(yesterday.split('-').map(Number))
    expect(record.kind, 'editing must not change the record kind').toBe('sleep')

    await context.close()
  })

  test('deleting a care timer record removes it and undo restores the same id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logTummyPreset(page, 5)
    const created = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the record to delete never reached the API')
    const originalId = apiCollection(created, 'tummyTimes')[0].id

    await deleteRow(timelineRows.careTimer(page).first(), 'Tummy Time actions', 'Delete Tummy Time', 'Confirm delete Tummy Time')
    await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 0, 'the delete never reached the API')

    await clickUndo(page, 'Undo Tummy Time delete')
    const restored = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the restored record never reached the API')
    expectExactlyOnce(apiCollection(restored, 'tummyTimes'), originalId, 'API tummyTimes after undo')

    await context.close()
  })
})

test.describe('acceptance: custom trackers', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL), NOT_ISOLATED_REASON)

  test('a timed tracker definition persists and its timer saves a custom event', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await createCustomTracker(page, { name: 'Physio', goal: 'Minutes', amount: 12 })

    // The definition itself is durable state, not just a local preference.
    const defined = await waitForApiState(request, (s) => apiCollection(s, 'customTrackers').length === 1, 'the tracker definition never reached the API')
    const tracker = apiCollection(defined, 'customTrackers')[0]
    expect(tracker.name).toBe('Physio')
    expect(tracker.timer, 'a minutes goal must make the tracker timed').toBe(true)
    expect(tracker.goal).toEqual({ kind: 'duration', targetMinutes: 12 })

    // A timed tracker earns its own slot in the care launcher.
    await openLauncher(page, 'Physio')
    await waitForTimerSeconds(page, 1)
    await stopCareTimer(page, 'Physio')

    const state = await waitForApiState(request, (s) => apiCollection(s, 'customEvents').length === 1, 'the custom timer event never reached the API')
    const events = apiCollection(state, 'customEvents')
    const event = expectExactlyOnce(events, events[0].id, 'API customEvents')
    expect(event.trackerId, 'the event must point at its definition').toBe(tracker.id)
    expect(event.durationSeconds as number).toBeGreaterThan(0)
    // A caregiver timer must not be filed as tummy time.
    expect(apiCollection(state, 'tummyTimes')).toHaveLength(0)

    await context.close()
  })

  test("a once-a-day tracker logs from Today's needs and undo removes it", async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await createCustomTracker(page, { name: 'Iron drops', goal: 'Once' })
    await waitForApiState(request, (s) => apiCollection(s, 'customTrackers').length === 1, 'the tracker definition never reached the API')

    await careNeedRow(page, 'Iron drops').getByRole('button', { name: 'Log Iron drops' }).click()
    const logged = await waitForApiState(request, (s) => apiCollection(s, 'customEvents').length === 1, 'the custom log never reached the API')
    const eventId = apiCollection(logged, 'customEvents')[0].id
    expectExactlyOnce(apiCollection(logged, 'customEvents'), eventId, 'API customEvents')

    await clickUndo(page, 'Undo log')
    const state = await waitForApiState(request, (s) => apiCollection(s, 'customEvents').length === 0, 'the undone custom log was still on the server')
    expect(apiCollection(state, 'customEvents')).toHaveLength(0)
    // Undoing a log must never remove the definition it was logged against.
    expect(apiCollection(state, 'customTrackers')).toHaveLength(1)

    await context.close()
  })

  test('renaming a tracker definition keeps its id and its logged history', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await createCustomTracker(page, { name: 'Vitamin C', goal: 'Once' })
    const defined = await waitForApiState(request, (s) => apiCollection(s, 'customTrackers').length === 1, 'the tracker definition never reached the API')
    const trackerId = apiCollection(defined, 'customTrackers')[0].id

    await careNeedRow(page, 'Vitamin C').getByRole('button', { name: 'Log Vitamin C' }).click()
    const logged = await waitForApiState(request, (s) => apiCollection(s, 'customEvents').length === 1, 'the custom log never reached the API')
    const eventId = apiCollection(logged, 'customEvents')[0].id

    await openSettings(page)
    await openSettingsTab(page, 'Baby')
    await page.getByRole('button', { name: 'Edit Vitamin C' }).click()
    await page.getByRole('textbox', { name: 'Tracker name' }).fill('Vitamin C plus')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await closeSettings(page)

    const renamed = await waitForApiState(
      request,
      (s) => apiCollection(s, 'customTrackers').some((item) => item.name === 'Vitamin C plus'),
      'the tracker rename never reached the API',
    )
    const tracker = expectExactlyOnce(apiCollection(renamed, 'customTrackers'), trackerId, 'API customTrackers after rename')
    expect(tracker.name).toBe('Vitamin C plus')
    // Renaming a definition must not orphan or duplicate what was logged.
    expectExactlyOnce(apiCollection(renamed, 'customEvents'), eventId, 'API customEvents after rename')

    await context.close()
  })

  test('deleting a custom log removes it and undo restores the same id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await createCustomTracker(page, { name: 'Outside time', goal: 'Once' })
    await waitForApiState(request, (s) => apiCollection(s, 'customTrackers').length === 1, 'the tracker definition never reached the API')
    await careNeedRow(page, 'Outside time').getByRole('button', { name: 'Log Outside time' }).click()
    const logged = await waitForApiState(request, (s) => apiCollection(s, 'customEvents').length === 1, 'the custom log never reached the API')
    const eventId = apiCollection(logged, 'customEvents')[0].id

    await deleteRow(timelineRows.custom(page).first(), 'Outside time actions', 'Delete Outside time log', 'Confirm delete Outside time log')
    await waitForApiState(request, (s) => apiCollection(s, 'customEvents').length === 0, 'the custom log delete never reached the API')

    await clickUndo(page, 'Undo log delete')
    const restored = await waitForApiState(request, (s) => apiCollection(s, 'customEvents').length === 1, 'the restored custom log never reached the API')
    expectExactlyOnce(apiCollection(restored, 'customEvents'), eventId, 'API customEvents after undo')

    await context.close()
  })
})
