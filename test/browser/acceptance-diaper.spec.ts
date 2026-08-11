/**
 * Release acceptance matrix — section B: standalone diapers.
 *
 * Covers creation of all three kinds, editing date and kinds, cancelling the
 * quick sheet, undoing a log, and the delete → restore pair that a caregiver
 * reaches from the timeline row's own menu.
 */
import { expect, test } from '@playwright/test'
import {
  apiCollection, expectExactlyOnce, isIsolatedTarget, NOT_ISOLATED_REASON,
  openAppPage, resetApiState, resetSharedCandidate, waitForApiState,
} from './helpers/acceptance'
import { clickUndo, deleteRow, logStandaloneDiaper, openLauncher, startRowEdit, timelineRows } from './helpers/careUi'

test.describe.configure({ mode: 'serial' })

const kinds = (record: Record<string, unknown>) => record.kinds as string[]

test.describe('acceptance: diapers', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL), NOT_ISOLATED_REASON)

  // Specs share one candidate; leave it empty for whatever runs next.
  test.afterAll(resetSharedCandidate)

  for (const { choice, expected } of [
    { choice: 'Wet' as const, expected: ['wet'] },
    { choice: 'Stool' as const, expected: ['stool'] },
    { choice: 'Mixed' as const, expected: ['wet', 'stool'] },
  ]) {
    test(`a ${choice.toLowerCase()} diaper creates exactly one standalone record`, async ({ browser, request, baseURL }) => {
      await resetApiState(request)
      const { context, page } = await openAppPage(browser, baseURL!)

      await logStandaloneDiaper(page, choice)

      const state = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 1, `the ${choice} diaper never reached the API`)
      const diapers = apiCollection(state, 'diapers')
      const diaper = expectExactlyOnce(diapers, diapers[0].id, 'API diapers')
      expect(kinds(diaper)).toEqual(expected)
      expect(diaper.context, 'a diaper logged from the launcher is standalone').toBe('standalone')

      await context.close()
    })
  }

  test('closing the diaper sheet creates nothing', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await openLauncher(page, 'Diapers')
    await expect(page.getByRole('button', { name: 'Close diaper menu' })).toBeVisible()
    await page.getByRole('button', { name: 'Close diaper menu' }).click()
    await expect(page.getByRole('button', { name: 'Close diaper menu' })).toHaveCount(0)

    // Wait past the debounced whole-state PUT so this cannot pass by racing it.
    await page.waitForTimeout(1500)
    const state = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 0, 'cancelling the diaper sheet created a record')
    expect(apiCollection(state, 'diapers')).toHaveLength(0)

    await context.close()
  })

  test('undoing a diaper log removes it everywhere', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logStandaloneDiaper(page, 'Wet')
    await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 1, 'the diaper to undo never reached the API')

    await clickUndo(page, 'Undo diaper log')
    await expect(timelineRows.diaper(page)).toHaveCount(0)

    // Undo of a log is a real deletion server-side, not just a local hide.
    const state = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 0, 'the undone diaper was still on the server')
    expect(apiCollection(state, 'diapers')).toHaveLength(0)

    await context.close()
  })

  test('editing a diaper changes its date and kinds without changing its id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logStandaloneDiaper(page, 'Wet')
    const created = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 1, 'the diaper to edit never reached the API')
    const original = apiCollection(created, 'diapers')[0]
    const originalId = original.id

    const yesterday = await page.evaluate(() => {
      const date = new Date()
      date.setDate(date.getDate() - 1)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })

    const row = timelineRows.diaper(page).first()
    await startRowEdit(row, 'Diaper actions', 'Edit diaper')
    await row.getByLabel('Diaper date').fill(yesterday)
    await row.getByRole('button', { name: 'Select stool diaper' }).click()
    await row.getByRole('button', { name: 'Save diaper' }).click()
    await expect(page.locator('.toast')).toContainText('Diaper updated')

    const edited = await waitForApiState(
      request,
      (s) => apiCollection(s, 'diapers').some((item) => item.id === originalId && (item.kinds as string[])?.length === 2),
      'the diaper edit never reached the API',
    )
    const diapers = apiCollection(edited, 'diapers')
    expect(diapers, 'editing must not fork a second diaper').toHaveLength(1)
    const diaper = expectExactlyOnce(diapers, originalId, 'API diapers after edit')
    expect(kinds(diaper)).toEqual(['wet', 'stool'])
    const at = new Date(diaper.at as number)
    expect([at.getFullYear(), at.getMonth() + 1, at.getDate()]).toEqual(yesterday.split('-').map(Number))
    // The clock time of day is preserved when only the date is edited.
    expect(at.getHours()).toBe(new Date(original.at as number).getHours())

    await context.close()
  })

  test('an edit that clears every kind is rejected and leaves the record intact', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logStandaloneDiaper(page, 'Wet')
    const created = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 1, 'the diaper never reached the API')
    const originalId = apiCollection(created, 'diapers')[0].id

    const row = timelineRows.diaper(page).first()
    await startRowEdit(row, 'Diaper actions', 'Edit diaper')
    await row.getByRole('button', { name: 'Select wet diaper' }).click() // deselect the only kind
    await row.getByRole('button', { name: 'Save diaper' }).click()

    await expect(page.locator('.toast')).toContainText('Select wet, stool, or both')
    // Rejected validation must not mutate or drop the stored record.
    const state = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 1, 'a rejected edit lost the diaper')
    expect(kinds(expectExactlyOnce(apiCollection(state, 'diapers'), originalId, 'API diapers'))).toEqual(['wet'])

    await context.close()
  })

  test('deleting a diaper removes it and undo restores the same id', async ({ browser, request, baseURL }) => {
    await resetApiState(request)
    const { context, page } = await openAppPage(browser, baseURL!)

    await logStandaloneDiaper(page, 'Mixed')
    const created = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 1, 'the diaper to delete never reached the API')
    const originalId = apiCollection(created, 'diapers')[0].id

    await deleteRow(timelineRows.diaper(page).first(), 'Diaper actions', 'Delete diaper', 'Confirm delete diaper')
    await expect(timelineRows.diaper(page)).toHaveCount(0)
    await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 0, 'the diaper delete never reached the API')

    await clickUndo(page, 'Undo diaper delete')
    await expect(timelineRows.diaper(page)).toHaveCount(1)

    // Restoring must lift the server's tombstone, not merely re-render locally.
    const restored = await waitForApiState(request, (s) => apiCollection(s, 'diapers').length === 1, 'the restored diaper never reached the API')
    const diaper = expectExactlyOnce(apiCollection(restored, 'diapers'), originalId, 'API diapers after undo')
    expect(kinds(diaper)).toEqual(['wet', 'stool'])

    await context.close()
  })
})
