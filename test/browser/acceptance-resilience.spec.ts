/**
 * Release acceptance matrix — section F: outage, reload and exactly-once replay.
 *
 * This is the gate unit and UI coverage cannot stand in for. For each durable
 * record family it drives two real browser clients against the disposable
 * candidate, takes the backend away mid-session, keeps working offline, reloads
 * while still offline, brings the backend back, and then proves that every
 * record exists exactly once — on the server, in the client that made it, and
 * in the client that only watched.
 *
 * Two invariants are worth stating plainly, because they are what the whole
 * scenario exists to protect:
 *
 *   * **Exactly once.** Replaying a queued write must converge, not duplicate.
 *     Every id is asserted to appear precisely one time in all three places;
 *     a count of two is the signature of a replay that re-created instead of
 *     re-sent, and it is silent in ordinary use.
 *   * **Nothing is lost.** An offline action and the edit made on top of it
 *     must both survive the outage, the reload, and the reconnect, with the
 *     edited values intact — existence alone would pass even if the edit had
 *     been rolled back.
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  apiCollection, captureFailureArtifacts, expectExactlyOnce, hasPendingLocalWork,
  isAcceptanceServerPaused, isIsolatedTarget, journalRecordsMentioning, NOT_ISOLATED_REASON,
  openAppPage, readApiState, readForensicJournal, readLocalCollection, resetApiState,
  resetSharedCandidate,
  unpauseAcceptanceServer, waitForAcceptanceHealthy, waitForApiState, waitForAppReady,
  primeOfflineShell, withServerOutage, type ApiState, type IdCollection,
} from './helpers/acceptance'
import {
  logMedicine, logStandaloneDiaper, openLauncher, startRowEdit, timelineRows,
} from './helpers/careUi'

test.describe.configure({ mode: 'serial' })

type Variant = 'online' | 'offline'

type Family = {
  name: string
  collection: IdCollection
  storageSuffix: string
  rows: (page: Page) => Locator
  create: (page: Page) => Promise<void>
  /** Edit the newest row of this family to a value unique to the variant. */
  edit: (page: Page, variant: Variant) => Promise<void>
  /** The field the edit changes, read off an API/localStorage record. */
  valueOf: (record: Record<string, unknown>) => unknown
  expected: (variant: Variant) => unknown
}

const editFeedNote = async (page: Page, note: string) => {
  const row = timelineRows.feed(page).first()
  await startRowEdit(row, 'Entry actions', 'Edit entry')
  const panel = row.locator('.edit-panel')
  await panel.getByLabel('Note').fill(note)
  await panel.getByRole('button', { name: 'Save' }).click()
  await expect(panel).toHaveCount(0)
}

const families: Family[] = [
  {
    name: 'feed entry',
    collection: 'entries',
    storageSuffix: ':entries',
    rows: timelineRows.feed,
    create: async (page) => {
      await openLauncher(page, 'Bottle')
      await page.getByRole('button', { name: 'Log bottle' }).click()
    },
    edit: (page, variant) => editFeedNote(page, `${variant} feed note`),
    valueOf: (record) => record.note,
    expected: (variant) => `${variant} feed note`,
  },
  {
    name: 'standalone diaper',
    collection: 'diapers',
    storageSuffix: ':diapers',
    rows: timelineRows.diaper,
    create: (page) => logStandaloneDiaper(page, 'Wet'),
    edit: async (page, variant) => {
      const row = timelineRows.diaper(page).first()
      await startRowEdit(row, 'Diaper actions', 'Edit diaper')
      // Online keeps wet and adds stool; offline swaps to stool alone, so the
      // two records stay distinguishable by their edited value.
      await row.getByRole('button', { name: 'Select stool diaper' }).click()
      if (variant === 'offline') await row.getByRole('button', { name: 'Select wet diaper' }).click()
      await row.getByRole('button', { name: 'Save diaper' }).click()
      await expect(row.getByRole('button', { name: 'Save diaper' })).toHaveCount(0)
    },
    valueOf: (record) => (record.kinds as string[])?.join('+'),
    expected: (variant) => (variant === 'online' ? 'wet+stool' : 'stool'),
  },
  {
    name: 'care-timer entry',
    collection: 'tummyTimes',
    storageSuffix: ':tummy-times',
    rows: timelineRows.careTimer,
    create: async (page) => {
      await openLauncher(page, 'Tummy')
      await page.getByRole('button', { name: '10 minutes', exact: true }).click()
    },
    edit: async (page, variant) => {
      const row = timelineRows.careTimer(page).first()
      await startRowEdit(row, 'Tummy Time actions', 'Edit Tummy Time')
      await row.getByLabel('Tummy Time note').fill(`${variant} care note`)
      await row.getByRole('button', { name: 'Save Tummy Time' }).click()
      await expect(row.getByRole('button', { name: 'Save Tummy Time' })).toHaveCount(0)
    },
    valueOf: (record) => record.note,
    expected: (variant) => `${variant} care note`,
  },
  {
    name: 'medicine',
    collection: 'medicines',
    storageSuffix: ':medicines',
    rows: timelineRows.medicine,
    create: (page) => logMedicine(page, 'Tylenol'),
    edit: async (page, variant) => {
      const row = timelineRows.medicine(page).first()
      await startRowEdit(row, 'Medicine actions', 'Edit medicine')
      await row.getByRole('button', { name: variant === 'online' ? 'Select Motrin' : 'Select Vitamin D' }).click()
      await row.getByRole('button', { name: 'Save medicine' }).click()
      await expect(row.getByRole('button', { name: 'Save medicine' })).toHaveCount(0)
    },
    valueOf: (record) => record.kind,
    expected: (variant) => (variant === 'online' ? 'motrin' : 'vitamin_d'),
  },
]

/** The id of the record carrying this edited value, asserted to be unique. */
const idWithValue = (records: Array<Record<string, unknown> & { id: string }>, family: Family, value: unknown, where: string) => {
  const matches = records.filter((record) => family.valueOf(record) === value)
  expect(matches.length, `expected exactly one ${family.name} with ${JSON.stringify(value)} in ${where}, found ${matches.length}`).toBe(1)
  return matches[0].id
}

test.describe('acceptance: outage, reload and exactly-once replay', () => {
  test.skip(({ baseURL }) => !isIsolatedTarget(baseURL), NOT_ISOLATED_REASON)

  // Never leave the candidate frozen for the next spec, whatever happened here.
  test.afterEach(async ({ baseURL }) => {
    if (await isAcceptanceServerPaused()) {
      await unpauseAcceptanceServer(baseURL)
      await waitForAcceptanceHealthy(baseURL)
    }
  })

  // Specs share one candidate; leave it empty for whatever runs next.
  test.afterAll(resetSharedCandidate)

  for (const family of families) {
    test(`${family.name}: survives an outage, an offline reload and reconnect exactly once`, async ({ browser, request, baseURL }, testInfo) => {
      test.setTimeout(180_000)
      await resetApiState(request)

      // --- two independent clients of the same candidate -------------------
      const a = await openAppPage(browser, baseURL!)
      const b = await openAppPage(browser, baseURL!)
      // The app shell is served by the very server we are about to take away,
      // so the service worker's cache is the only thing that can answer the
      // offline reload. Prime it before the outage.
      await primeOfflineShell(a.page)

      try {
        // --- 1. create and edit online in A ------------------------------
        await family.create(a.page)
        await waitForApiState(request, (s) => apiCollection(s, family.collection).length === 1, `${family.name}: the online record never reached the API`)
        await family.edit(a.page, 'online')

        const onlineState = await waitForApiState(
          request,
          (s) => apiCollection(s, family.collection).some((r) => family.valueOf(r) === family.expected('online')),
          `${family.name}: the online edit never reached the API`,
        )
        const onlineId = idWithValue(apiCollection(onlineState, family.collection), family, family.expected('online'), 'API state')

        // --- 2. B converges without being touched -------------------------
        await expect.poll(
          async () => (await readLocalCollection(b.page, family.storageSuffix)).filter((r) => r.id === onlineId).length,
          { message: `${family.name}: context B never saw the online record`, timeout: 30_000 },
        ).toBe(1)

        let offlineId = ''
        // --- 3. take the backend away ------------------------------------
        await withServerOutage(baseURL, [a.context, b.context], async () => {
          // --- 4. create and edit a second record while offline ----------
          await family.create(a.page)
          await expect(family.rows(a.page)).toHaveCount(2)
          await family.edit(a.page, 'offline')

          // --- 5. it stays locally visible and stays marked pending ------
          await expect.poll(
            async () => (await readLocalCollection(a.page, family.storageSuffix)).filter((r) => family.valueOf(r) === family.expected('offline')).length,
            { message: `${family.name}: the offline edit was not held locally`, timeout: 15_000 },
          ).toBe(1)
          expect(await hasPendingLocalWork(a.page), `${family.name}: the offline change was not marked pending`).toBe(true)
          // Only the wider layouts render a sync indicator — the navigation-rail
          // layout has no equivalent — so assert on it where it exists rather
          // than assume a breakpoint. The pending marker above is the
          // substantive check and is asserted on every viewport.
          const syncPill = a.page.locator('.sync-pill')
          if (await syncPill.count() > 0) {
            await expect(syncPill, 'the sync indicator should say the client is holding offline changes').toContainText(/Offline|Syncing/)
          }

          const beforeReload = await readLocalCollection(a.page, family.storageSuffix)
          offlineId = idWithValue(beforeReload, family, family.expected('offline'), "context A's local store")
          expect(offlineId, 'the offline record must be a new record, not a mutation of the online one').not.toBe(onlineId)

          // --- 6. reload while still offline -----------------------------
          // Served from the service worker's cache, because the origin is gone.
          await a.page.reload()
          await waitForAppReady(a.page)

          // --- 7. the offline record AND its edit survived the reload ----
          const afterReload = await readLocalCollection(a.page, family.storageSuffix)
          expect(afterReload.filter((r) => r.id === offlineId), `${family.name}: the offline record did not survive the reload`).toHaveLength(1)
          expect(family.valueOf(afterReload.find((r) => r.id === offlineId)!), `${family.name}: the offline edit was rolled back by the reload`).toEqual(family.expected('offline'))
          expect(await hasPendingLocalWork(a.page), `${family.name}: the pending marker was lost across the reload`).toBe(true)
          await expect(family.rows(a.page), `${family.name}: both records should still be on screen offline`).toHaveCount(2)
        })

        // --- 8. the server is back; convergence must be automatic ---------
        // Nothing below taps a "sync" control: the only inputs are the network
        // coming back and time passing.
        const converged = await waitForApiState(
          request,
          (s) => apiCollection(s, family.collection).length === 2
            && apiCollection(s, family.collection).some((r) => family.valueOf(r) === family.expected('offline')),
          `${family.name}: the queued offline work never replayed after the server returned`,
          60_000,
        )

        // --- 9. exactly once, everywhere ----------------------------------
        const apiRecords = apiCollection(converged, family.collection)
        expect(apiRecords, `${family.name}: the API should hold exactly the two records`).toHaveLength(2)
        const apiOnline = expectExactlyOnce(apiRecords, onlineId, 'API state')
        const apiOffline = expectExactlyOnce(apiRecords, offlineId, 'API state')
        // --- 10. and with the edited values, not merely present -----------
        expect(family.valueOf(apiOnline), `${family.name}: the online edit was lost`).toEqual(family.expected('online'))
        expect(family.valueOf(apiOffline), `${family.name}: the offline edit was lost`).toEqual(family.expected('offline'))

        for (const [label, client] of [['A', a], ['B', b]] as const) {
          await expect.poll(
            async () => (await readLocalCollection(client.page, family.storageSuffix)).length,
            { message: `${family.name}: context ${label} did not converge on exactly two records`, timeout: 60_000 },
          ).toBe(2)
          const local = await readLocalCollection(client.page, family.storageSuffix)
          const localOnline = expectExactlyOnce(local, onlineId, `context ${label}`)
          const localOffline = expectExactlyOnce(local, offlineId, `context ${label}`)
          expect(family.valueOf(localOnline), `${family.name}: context ${label} lost the online edit`).toEqual(family.expected('online'))
          expect(family.valueOf(localOffline), `${family.name}: context ${label} lost the offline edit`).toEqual(family.expected('offline'))
          // A duplicate would render as a third row even if the ids matched.
          await expect(family.rows(client.page), `${family.name}: context ${label} rendered a duplicate row`).toHaveCount(2)
        }

        // --- 11. the forensic ledger still holds the evidence -------------
        const journal = await readForensicJournal(a.page)
        const onlineTrail = journalRecordsMentioning(journal, onlineId)
        const offlineTrail = journalRecordsMentioning(journal, offlineId)
        expect(onlineTrail.length, `${family.name}: no reconstructable snapshot for the online action`).toBeGreaterThan(0)
        expect(offlineTrail.length, `${family.name}: no reconstructable snapshot for the offline action`).toBeGreaterThan(0)
        // The edit has to be reconstructable too, not just the creation.
        expect(
          offlineTrail.some((record) => JSON.stringify(record.payload).includes(String(family.expected('offline')))),
          `${family.name}: the offline edit is not reconstructable from the ledger`,
        ).toBe(true)
        // Writes that were attempted during the outage and failed are evidence
        // in their own right, and acknowledgement of the replay must not sweep
        // them away — the ledger is append-only by contract.
        const failures = journal.filter((record) => record.kind === 'state-write')
        expect(failures.length, `${family.name}: the outage left no attempted-write failure evidence`).toBeGreaterThan(0)
        expect(
          failures.some((record) => JSON.stringify(record.payload).includes(offlineId)),
          `${family.name}: no failed write captured the offline record it was carrying`,
        ).toBe(true)

        // Re-read after convergence has fully settled: a successful upload must
        // not trim, compact or delete anything already written.
        await a.page.waitForTimeout(2000)
        const journalAfter = await readForensicJournal(a.page)
        expect(journalAfter.length, `${family.name}: the ledger shrank after a successful upload`).toBeGreaterThanOrEqual(journal.length)
        expect(
          journalAfter.filter((record) => record.kind === 'state-write').length,
          `${family.name}: failure records were removed once the write was acknowledged`,
        ).toBeGreaterThanOrEqual(failures.length)
      } finally {
        await captureFailureArtifacts(testInfo, request, { a: a.page, b: b.page })
        await a.context.close()
        await b.context.close()
      }
    })
  }

  test('the candidate is healthy and holds no duplicate ids after the outage matrix', async ({ request, baseURL }) => {
    await waitForAcceptanceHealthy(baseURL)
    const state: ApiState = await readApiState(request)
    for (const collection of ['entries', 'diapers', 'medicines', 'tummyTimes'] as IdCollection[]) {
      const ids = apiCollection(state, collection).map((record) => record.id)
      expect(new Set(ids).size, `${collection} contains duplicate ids`).toBe(ids.length)
    }
  })
})
