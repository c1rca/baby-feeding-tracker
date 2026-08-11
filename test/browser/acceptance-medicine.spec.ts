/**
 * Release acceptance matrix — section D: medicines.
 *
 * Covers the three named doses, a free-text custom medicine, the two
 * validation paths a caregiver can actually hit, undo, and editing kind, date
 * and time on a saved dose.
 */
import { expect, test } from '@playwright/test'
import {
  apiCollection, expectExactlyOnce, isIsolatedTarget, NOT_ISOLATED_REASON,
  openAppPage, resetApiState, resetSharedCandidate, waitForApiState,
} from './helpers/acceptance'
import {
  careNeedRow, clickUndo, deleteRow, logCustomMedicine, logMedicine, openLauncher,
  startRowEdit, timelineRows,
} from './helpers/careUi'

test.describe.configure({ mode: 'serial' })

test.describe('acceptance: medicines', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL), NOT_ISOLATED_REASON)

  // Specs share one candidate; leave it empty for whatever runs next.
  test.afterAll(resetSharedCandidate)

  for (const { label, kind } of [
    { label: 'Tylenol' as const, kind: 'tylenol' },
    { label: 'Motrin' as const, kind: 'motrin' },
    { label: 'Vitamin D' as const, kind: 'vitamin_d' },
  ]) {
    test(`${label} logs exactly one dose of the right kind`, async ({ browser, request, baseURL }) => {
      await resetApiState(request)
      const { context, page } = await openAppPage(browser, baseURL!)

      await logMedicine(page, label)

      const state = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, `the ${label} dose never reached the API`)
      const medicines = apiCollection(state, 'medicines')
      const medicine = expectExactlyOnce(medicines, medicines[0].id, 'API medicines')
      expect(medicine.kind).toBe(kind)

      await context.close()
    })
  }

  test('a custom medicine records the name it was given', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logCustomMedicine(page, 'Iron drops')

    const state = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, 'the custom dose never reached the API')
    const medicine = apiCollection(state, 'medicines')[0]
    expect(medicine.kind).toBe('custom')
    expect(medicine.name).toBe('Iron drops')

    await context.close()
  })

  test('an unnamed custom medicine cannot be logged', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await openLauncher(page, 'Medicine')
    // The control is genuinely disabled rather than failing on submit, so an
    // incomplete custom dose can never be created in the first place.
    await expect(page.getByRole('button', { name: 'Log other medicine' })).toBeDisabled()
    await page.getByLabel('Other medicine name').fill('   ')
    await expect(page.getByRole('button', { name: 'Log other medicine' }), 'whitespace is not a medicine name').toBeDisabled()
    await page.getByRole('button', { name: 'Close medicine menu' }).click()

    await page.waitForTimeout(1500)
    const state = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 0, 'an incomplete custom medicine was logged anyway')
    expect(apiCollection(state, 'medicines')).toHaveLength(0)

    await context.close()
  })

  test("Vitamin D can also be logged from Today's needs", async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await careNeedRow(page, 'Vitamin D').getByRole('button', { name: 'Log Vitamin D dose' }).click()

    const state = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, "the Today's needs dose never reached the API")
    expect(apiCollection(state, 'medicines')[0].kind).toBe('vitamin_d')
    // The row flips to done rather than offering a second identical tap.
    await expect(careNeedRow(page, 'Vitamin D')).toContainText('Given at')

    await context.close()
  })

  test('undoing a medicine log removes it everywhere', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logMedicine(page, 'Tylenol')
    await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, 'the dose to undo never reached the API')

    await clickUndo(page, 'Undo medicine log')
    await expect(timelineRows.medicine(page)).toHaveCount(0)

    const state = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 0, 'the undone dose was still on the server')
    expect(apiCollection(state, 'medicines')).toHaveLength(0)

    await context.close()
  })

  test('editing a dose changes kind, date and time without changing its id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logMedicine(page, 'Tylenol')
    const created = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, 'the dose to edit never reached the API')
    const originalId = apiCollection(created, 'medicines')[0].id

    const target = await page.evaluate(() => {
      const date = new Date()
      date.setDate(date.getDate() - 1)
      date.setHours(7, 45, 0, 0)
      return {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        ms: date.getTime(),
      }
    })

    const row = timelineRows.medicine(page).first()
    await startRowEdit(row, 'Medicine actions', 'Edit medicine')
    await row.getByRole('button', { name: 'Select Motrin' }).click()
    await row.getByLabel('Medicine date').fill(target.date)
    await row.getByLabel('Medicine time').fill(target.time)
    await row.getByRole('button', { name: 'Save medicine' }).click()
    await expect(page.locator('.toast')).toContainText('Medicine updated')

    const edited = await waitForApiState(
      request,
      (s) => apiCollection(s, 'medicines').some((item) => item.id === originalId && item.kind === 'motrin'),
      'the dose edit never reached the API',
    )
    const medicines = apiCollection(edited, 'medicines')
    expect(medicines, 'editing must not fork a second dose').toHaveLength(1)
    const medicine = expectExactlyOnce(medicines, originalId, 'API medicines after edit')
    expect(medicine.kind).toBe('motrin')
    expect(medicine.at).toBe(target.ms)

    await context.close()
  })

  test('an invalid medicine time is rejected and leaves the dose intact', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logMedicine(page, 'Tylenol')
    const created = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, 'the dose never reached the API')
    const original = apiCollection(created, 'medicines')[0]

    const row = timelineRows.medicine(page).first()
    await startRowEdit(row, 'Medicine actions', 'Edit medicine')
    await row.getByLabel('Medicine time').fill('half past nine')
    await row.getByRole('button', { name: 'Save medicine' }).click()

    await expect(page.locator('.toast')).toContainText('Enter a valid medicine time')
    const state = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, 'a rejected edit lost the dose')
    const medicine = expectExactlyOnce(apiCollection(state, 'medicines'), original.id, 'API medicines')
    expect(medicine.at, 'a rejected edit must not mutate the dose').toBe(original.at)
    expect(medicine.kind).toBe('tylenol')

    await context.close()
  })

  test('deleting a dose removes it and undo restores the same id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logMedicine(page, 'Motrin')
    const created = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, 'the dose to delete never reached the API')
    const originalId = apiCollection(created, 'medicines')[0].id

    await deleteRow(timelineRows.medicine(page).first(), 'Medicine actions', 'Delete medicine', 'Confirm delete medicine')
    await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 0, 'the dose delete never reached the API')

    await clickUndo(page, 'Undo medicine delete')
    const restored = await waitForApiState(request, (s) => apiCollection(s, 'medicines').length === 1, 'the restored dose never reached the API')
    expect(expectExactlyOnce(apiCollection(restored, 'medicines'), originalId, 'API medicines after undo').kind).toBe('motrin')

    await context.close()
  })
})
