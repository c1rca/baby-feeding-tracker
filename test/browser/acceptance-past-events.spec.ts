/**
 * Release acceptance matrix — section E: backdated events.
 *
 * The past-event sheet is the only way to correct history after the fact, so
 * it is asserted on the timestamp that actually lands, on the timeline order
 * that results, and on the guarantee that closing it writes nothing.
 */
import { expect, test, type Page } from '@playwright/test'
import {
  apiCollection, expectExactlyOnce, isIsolatedTarget, NOT_ISOLATED_REASON,
  openAppPage, resetApiState, resetSharedCandidate, waitForApiState,
} from './helpers/acceptance'
import { revealOlderTimelineEvents, startRowEdit, timelineRows } from './helpers/careUi'

test.describe.configure({ mode: 'serial' })

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Log a past event' })

const openPastEventSheet = async (page: Page) => {
  await page.getByRole('button', { name: 'Log a past event' }).click()
  await expect(sheet(page)).toBeVisible()
}

const chooseKind = async (page: Page, label: string) => {
  await sheet(page).getByRole('group', { name: 'Event type' }).getByRole('button', { name: label, exact: true }).click()
}

/** A local date/time `daysAgo` days back at a fixed wall clock, as the inputs want it. */
const pastMoment = (page: Page, daysAgo: number, hours: number, minutes: number) => page.evaluate(({ daysAgo, hours, minutes }) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hours, minutes, 0, 0)
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    ms: date.getTime(),
  }
}, { daysAgo, hours, minutes })

const setWhen = async (page: Page, when: { date: string; time: string }) => {
  await sheet(page).getByLabel('Date').fill(when.date)
  await sheet(page).getByLabel('Time').fill(when.time)
}

const savePastEvent = async (page: Page) => {
  await sheet(page).getByRole('button', { name: 'Save past event' }).click()
  await expect(sheet(page)).toHaveCount(0)
}

test.describe('acceptance: past events', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL), NOT_ISOLATED_REASON)

  // Specs share one candidate; leave it empty for whatever runs next.
  test.afterAll(resetSharedCandidate)

  test('a backdated nursing feed lands on the chosen day and time', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const when = await pastMoment(page, 2, 9, 15)
    await openPastEventSheet(page)
    await chooseKind(page, 'Feed')
    await setWhen(page, when)
    await sheet(page).getByLabel('Left minutes').fill('14')
    await sheet(page).getByLabel('Right minutes').fill('6')
    await savePastEvent(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the backdated nursing feed never reached the API')
    const entries = apiCollection(state, 'entries')
    const entry = expectExactlyOnce(entries, entries[0].id, 'API entries')
    expect(entry.startedAt).toBe(when.ms)
    expect(entry.leftSeconds).toBe(840)
    expect(entry.rightSeconds).toBe(360)
    expect(entry.type).toBe('breast')

    await context.close()
  })

  test('a backdated bottle feed saves as a bottle', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const when = await pastMoment(page, 1, 13, 30)
    await openPastEventSheet(page)
    await chooseKind(page, 'Feed')
    await setWhen(page, when)
    await sheet(page).getByLabel(/^Bottle/).fill('4')
    await savePastEvent(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the backdated bottle never reached the API')
    const entry = apiCollection(state, 'entries')[0]
    expect(entry.type).toBe('bottle')
    expect(entry.bottleOunces).toBe(4)
    expect(entry.startedAt).toBe(when.ms)

    await context.close()
  })

  test('a backdated diaper lands on the chosen moment', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const when = await pastMoment(page, 1, 6, 20)
    await openPastEventSheet(page)
    await chooseKind(page, 'Diaper')
    await setWhen(page, when)
    await sheet(page).getByRole('button', { name: 'Mixed', exact: true }).click()
    await savePastEvent(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 1, 'the backdated diaper never reached the API')
    const diaper = apiCollection(state, 'diapers')[0]
    expect(diaper.at).toBe(when.ms)
    expect(diaper.kinds).toEqual(['wet', 'stool'])

    await context.close()
  })

  test('a backdated medicine dose lands on the chosen moment', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const when = await pastMoment(page, 1, 20, 5)
    await openPastEventSheet(page)
    await chooseKind(page, 'Medicine')
    await setWhen(page, when)
    await sheet(page).getByRole('button', { name: 'Motrin', exact: true }).click()
    await savePastEvent(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, 'the backdated dose never reached the API')
    const medicine = apiCollection(state, 'medicines')[0]
    expect(medicine.at).toBe(when.ms)
    expect(medicine.kind).toBe('motrin')

    await context.close()
  })

  test('a backdated sleep saves its span from the duration given', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const when = await pastMoment(page, 1, 22, 0)
    await openPastEventSheet(page)
    await chooseKind(page, 'Sleep')
    await setWhen(page, when)
    await sheet(page).getByLabel('Duration minutes').fill('95')
    await sheet(page).getByLabel('Note').fill('overnight stretch')
    await savePastEvent(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the backdated sleep never reached the API')
    const record = apiCollection(state, 'tummyTimes')[0]
    expect(record.kind).toBe('sleep')
    expect(record.startedAt).toBe(when.ms)
    expect((record.endedAt as number) - when.ms).toBe(95 * 60_000)
    expect(record.note).toBe('overnight stretch')

    await context.close()
  })

  test('a backdated tummy time saves against the care-timer history', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const when = await pastMoment(page, 1, 11, 0)
    await openPastEventSheet(page)
    await chooseKind(page, 'Tummy time')
    await setWhen(page, when)
    await sheet(page).getByLabel('Duration minutes').fill('12')
    await savePastEvent(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'tummyTimes').length === 1, 'the backdated tummy time never reached the API')
    const record = apiCollection(state, 'tummyTimes')[0]
    expect(record.kind).toBe('tummy')
    expect(record.startedAt).toBe(when.ms)

    await context.close()
  })

  test('a future-dated event is refused', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const tomorrow = await pastMoment(page, -1, 10, 0)
    await openPastEventSheet(page)
    await chooseKind(page, 'Feed')
    await setWhen(page, tomorrow)
    await sheet(page).getByLabel('Left minutes').fill('10')
    await sheet(page).getByRole('button', { name: 'Save past event' }).click()

    await expect(page.locator('.toast')).toContainText('Past events cannot be in the future')
    // The sheet stays open on a rejection, and nothing is written.
    await expect(sheet(page)).toBeVisible()
    await sheet(page).getByRole('button', { name: 'Cancel' }).click()

    await page.waitForTimeout(1500)
    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 0, 'a future-dated event was saved anyway')
    expect(apiCollection(state, 'entries')).toHaveLength(0)

    await context.close()
  })

  test('closing the past-event sheet writes nothing', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const when = await pastMoment(page, 1, 8, 0)
    await openPastEventSheet(page)
    await chooseKind(page, 'Feed')
    await setWhen(page, when)
    await sheet(page).getByLabel('Left minutes').fill('20')
    // Abandoning a half-filled sheet must leave no trace.
    await sheet(page).getByRole('button', { name: 'Close past event' }).click()
    await expect(sheet(page)).toHaveCount(0)

    await page.waitForTimeout(1500)
    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 0, 'closing the sheet created an entry')
    expect(apiCollection(state, 'entries')).toHaveLength(0)

    await context.close()
  })

  test('backdated and current feeds sort newest first in the timeline', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    // Deliberately entered oldest-last so ordering cannot come from insertion order.
    const older = await pastMoment(page, 2, 8, 0)
    const middle = await pastMoment(page, 1, 8, 0)

    await openPastEventSheet(page)
    await chooseKind(page, 'Feed')
    await setWhen(page, middle)
    await sheet(page).getByLabel('Left minutes').fill('11')
    await savePastEvent(page)
    await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the first backdated feed never reached the API')

    await openPastEventSheet(page)
    await chooseKind(page, 'Feed')
    await setWhen(page, older)
    await sheet(page).getByLabel('Left minutes').fill('22')
    await savePastEvent(page)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 2, 'the second backdated feed never reached the API')
    const entries = apiCollection(state, 'entries')
    expectExactlyOnce(entries, entries.find((item) => item.startedAt === older.ms)!.id, 'API entries')
    expectExactlyOnce(entries, entries.find((item) => item.startedAt === middle.ms)!.id, 'API entries')

    // Both days are on screen with the newer day above the older one.
    await revealOlderTimelineEvents(page)
    await expect(timelineRows.feed(page)).toHaveCount(2)
    const headers = await page.locator('.timeline-day-header strong').allTextContents()
    expect(headers.length, 'each backdated day needs its own group').toBeGreaterThanOrEqual(2)
    const durations = await timelineRows.feed(page).locator('.timeline-metrics').allTextContents()
    expect(durations[0], 'the more recent feed must sort above the older one').toContain('11m')
    expect(durations[1]).toContain('22m')

    await context.close()
  })

  test('a saved historical event can be edited and keeps its id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    const when = await pastMoment(page, 2, 10, 0)
    await openPastEventSheet(page)
    await chooseKind(page, 'Feed')
    await setWhen(page, when)
    await sheet(page).getByLabel('Left minutes').fill('10')
    await savePastEvent(page)

    const created = await waitForApiState(request, (s) => apiCollection(s, 'entries').length === 1, 'the historical feed never reached the API')
    const original = apiCollection(created, 'entries')[0]

    await revealOlderTimelineEvents(page)
    const row = timelineRows.feed(page).first()
    await startRowEdit(row, 'Entry actions', 'Edit entry')
    const panel = row.locator('.edit-panel')
    await panel.getByLabel('Left minutes').fill('18')
    await panel.getByLabel('Note').fill('corrected history')
    await panel.getByRole('button', { name: 'Save' }).click()

    const edited = await waitForApiState(
      request,
      (s) => apiCollection(s, 'entries').some((item) => item.id === original.id && item.leftSeconds === 1080),
      'the historical edit never reached the API',
    )
    const entries = apiCollection(edited, 'entries')
    expect(entries, 'editing history must not fork a second entry').toHaveLength(1)
    const entry = expectExactlyOnce(entries, original.id, 'API entries after edit')
    expect(entry.note).toBe('corrected history')
    // Editing details must not silently drag the event back to today.
    expect(entry.startedAt, 'the historical timestamp must be preserved').toBe(when.ms)

    await context.close()
  })
})
