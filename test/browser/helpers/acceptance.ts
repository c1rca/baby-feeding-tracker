/**
 * Shared plumbing for the release acceptance matrix.
 *
 * Everything here talks to the *disposable* acceptance candidate on 8082. The
 * helpers that can destroy data (fixture reset) or interrupt a server (outage
 * simulation) refuse to run against anything else, because the same Playwright
 * config also permits Dev on 8081 and Dev's SQLite is preserved and
 * authenticated. A guard that is merely documented is a guard that eventually
 * gets pointed at the wrong host.
 */
import { expect, request as apiRequest, type APIRequestContext, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** The disposable candidate container. Overridable so the stack can be renamed. */
export const ACCEPTANCE_CONTAINER = process.env.ACCEPTANCE_CONTAINER || 'bft-browser-acceptance'
/** The only port an acceptance-owned container is ever allowed to publish. */
const ACCEPTANCE_PORT = '8082'

export const isIsolatedTarget = (baseURL: string | undefined): boolean =>
  !!baseURL && new URL(baseURL).port === ACCEPTANCE_PORT

/** Human-readable reason used by `test.skip` when the suite runs against Dev. */
export const NOT_ISOLATED_REASON =
  `destructive acceptance fixtures and outage simulation only run against the disposable candidate on :${ACCEPTANCE_PORT}`

// ---------------------------------------------------------------------------
// Isolated API fixtures
// ---------------------------------------------------------------------------

export const ID_COLLECTIONS = [
  'entries', 'diapers', 'medicines', 'tummyTimes', 'pumpEvents',
  'growthMeasurements', 'healthRecords', 'customTrackers', 'customEvents',
] as const
export type IdCollection = typeof ID_COLLECTIONS[number]

export type ApiState = Record<string, unknown> & {
  updatedAt?: string | null
} & Partial<Record<IdCollection, Array<{ id: string }>>>

/**
 * Read the candidate's state.
 *
 * The one retry covers a *transport* failure only — Node closes an idle
 * keep-alive socket after a few seconds, and a request context that reuses it
 * at that moment sees "socket hang up" before anything reaches the server. That
 * is an artefact of connection pooling, not of the app, and it is the one thing
 * worth retrying here. An HTTP response that arrives and is not OK is a real
 * answer from the server and fails immediately, with its status.
 */
export const readApiState = async (request: Pick<APIRequestContext, 'get'>): Promise<ApiState> => {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await request.get('/api/state', { headers: { 'Cache-Control': 'no-store' } })
      expect(response.ok(), `GET /api/state failed with ${response.status()}`).toBeTruthy()
      return await response.json() as ApiState
    } catch (error) {
      const transportFailure = /socket hang up|ECONNRESET|EPIPE|socket disconnected/i.test(String(error))
      if (!transportFailure || attempt >= 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
}

const emptyIntents = () => {
  const deletes = {} as Record<IdCollection, string[]>
  const restores = {} as Record<IdCollection, string[]>
  for (const collection of ID_COLLECTIONS) { deletes[collection] = []; restores[collection] = [] }
  return { deletes, restores }
}

const BASELINE = {
  entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [],
  growthMeasurements: [], healthRecords: [], customTrackers: [], customEvents: [],
  pumpSession: null, tummySession: null, session: null,
  tummyGoalMinutes: 20, pumpGoalOunces: 0, pumpGoalSessions: 0,
  babyDob: '2026-01-01', theme: 'light' as const,
}

/**
 * Return the isolated candidate to a known baseline, optionally seeding rows.
 *
 * Two passes, and both are necessary.
 *
 * **Pass one — delete.** The server's sync contract is deliberately additive: a
 * whole-state PUT may add or update by id but *never* deletes by omission, so
 * writing an empty collection leaves every existing row in place. Clearing has
 * to name each id as an explicit delete intent, exactly as the client does when
 * a caregiver deletes something. `updatedAt` is echoed back so the write is not
 * read as a stale replay (which would preserve sessions and goals).
 *
 * **Pass two — lift the tombstones that pass one just wrote.** A delete leaves a
 * persisted tombstone, and that tombstone is permanent: the server will strip
 * that id out of every future write until an explicit *restore* intent removes
 * it. For real records that is the point — it is what stops a stale device
 * resurrecting something another device deleted. But it means a plain delete
 * would permanently burn any fixed id, and the older browser specs seed
 * themselves with fixed ids (`fixture-bottle`, `density-1`, …). Left alone,
 * this reset would quietly make those specs unseedable for the lifetime of the
 * container, and they would fail with an empty timeline for reasons that have
 * nothing to do with the code under test.
 *
 * Sending the restore intents *without* the ids in the payload clears the
 * tombstones and resurrects nothing, which is exactly "pristine".
 */
export const resetApiState = async (
  request: Pick<APIRequestContext, 'get' | 'put'>,
  seed: Partial<Record<IdCollection, unknown[]>> & Record<string, unknown> = {},
): Promise<ApiState> => {
  const current = await readApiState(request)
  const intents = emptyIntents()
  let deletedAny = false
  for (const collection of ID_COLLECTIONS) {
    const existing = Array.isArray(current[collection]) ? current[collection] : []
    const seeded = new Set((Array.isArray(seed[collection]) ? seed[collection] : []).map((item) => (item as { id: string }).id))
    // Anything we are re-seeding must not also be tombstoned, or the server
    // would drop the row we just asked it to keep.
    for (const item of existing) if (item?.id && !seeded.has(item.id)) intents.deletes[collection].push(item.id)
    if (intents.deletes[collection].length > 0) deletedAny = true
  }
  const response = await request.put('/api/state', {
    data: { ...BASELINE, ...seed, updatedAt: current.updatedAt ?? null, syncIntents: intents },
  })
  expect(response.ok(), `fixture reset PUT failed with ${response.status()}`).toBeTruthy()
  let state = (await response.json() as { state?: ApiState }).state ?? await readApiState(request)

  if (deletedAny) {
    const lift = emptyIntents()
    for (const collection of ID_COLLECTIONS) lift.restores[collection] = intents.deletes[collection]
    const cleanup = await request.put('/api/state', {
      data: { ...BASELINE, ...seed, updatedAt: state.updatedAt ?? null, syncIntents: lift },
    })
    expect(cleanup.ok(), `tombstone cleanup PUT failed with ${cleanup.status()}`).toBeTruthy()
    state = (await cleanup.json() as { state?: ApiState }).state ?? await readApiState(request)
  }
  return state
}

/**
 * Hand the shared candidate back empty.
 *
 * Every spec in the run points at the same server, and the older specs seed
 * themselves with a read-modify-write PUT — which, under the server's additive
 * contract, cannot remove anything an earlier spec left behind. Records left by
 * the acceptance matrix would therefore show up inside their fixtures and fail
 * them for reasons that have nothing to do with the code under test. Builds its
 * own request context because `request` is test-scoped and unavailable in
 * `afterAll`.
 */
export const resetSharedCandidate = async (): Promise<void> => {
  const baseURL = process.env.BROWSER_BASE_URL
  if (!isIsolatedTarget(baseURL)) return
  const context = await apiRequest.newContext({ baseURL })
  try {
    await resetApiState(context)
  } finally {
    await context.dispose()
  }
}

export const apiCollection = (state: ApiState, collection: IdCollection): Array<Record<string, unknown> & { id: string }> =>
  (Array.isArray(state[collection]) ? state[collection] : []) as Array<Record<string, unknown> & { id: string }>

/** Poll the isolated API until `predicate` holds, then return that state. */
export const waitForApiState = async (
  request: Pick<APIRequestContext, 'get'>,
  predicate: (state: ApiState) => boolean,
  message: string,
  timeout = 20_000,
): Promise<ApiState> => {
  let latest: ApiState = {}
  await expect.poll(async () => {
    latest = await readApiState(request)
    return predicate(latest)
  }, { message, timeout, intervals: [100, 200, 300, 500, 500, 1000] }).toBe(true)
  return latest
}

/** The single record with this id, asserting it is present exactly once. */
export const expectExactlyOnce = (
  items: Array<{ id: string }>,
  id: string,
  where: string,
): Record<string, unknown> & { id: string } => {
  const matches = items.filter((item) => item.id === id)
  expect(matches.length, `expected id ${id} exactly once in ${where}, found ${matches.length}`).toBe(1)
  return matches[0] as Record<string, unknown> & { id: string }
}

// ---------------------------------------------------------------------------
// Browser contexts
// ---------------------------------------------------------------------------

export type AppPage = { context: BrowserContext; page: Page }

/**
 * A fresh, independent client of the candidate: its own localStorage,
 * IndexedDB, service worker registration and sync client id.
 */
export const openAppPage = async (browser: Browser, baseURL: string): Promise<AppPage> => {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await page.goto('/')
  await waitForAppReady(page)
  return { context, page }
}

/** The care launcher only renders once the tracker view is live. */
export const waitForAppReady = async (page: Page): Promise<void> => {
  await expect(page.locator('.care-launcher')).toBeVisible({ timeout: 30_000 })
}

/**
 * Wait until the service worker controls the page.
 *
 * Reloading during the outage window depends on it: the app shell is served by
 * the same server we are about to take away, and the worker's cache is the only
 * thing that can hand back an `index.html` while it is gone.
 */
export const waitForServiceWorkerControl = async (page: Page): Promise<void> => {
  await expect.poll(
    () => page.evaluate(() => !!navigator.serviceWorker?.controller),
    { message: 'service worker never took control, so an offline reload cannot be served', timeout: 30_000 },
  ).toBe(true)
}

/** Paths the service worker has a cached response for, across all its caches. */
export const cachedPaths = (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    const paths: string[] = []
    for (const key of await caches.keys()) {
      const cache = await caches.open(key)
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname)
    }
    return paths
  })

/**
 * Wait until this client can survive losing the network.
 *
 * The build injects the hashed bundle into the worker's precache list, so a
 * first visit is offline-capable as soon as the worker controls the page — no
 * priming navigation needed. The assertion stays because it is the thing that
 * makes the rest of the outage scenario meaningful: if a future change stops
 * the bundle being precached, this fails here, plainly, instead of surfacing
 * later as what looks like data loss on reload.
 */
export const primeOfflineShell = async (page: Page): Promise<void> => {
  await waitForServiceWorkerControl(page)
  await expect.poll(
    async () => (await cachedPaths(page)).filter((path) => /^\/assets\/.*\.js$/.test(path)).length,
    { message: 'the service worker never precached the app bundle, so an offline reload cannot boot', timeout: 20_000 },
  ).toBeGreaterThan(0)
}

// ---------------------------------------------------------------------------
// Outage simulation
// ---------------------------------------------------------------------------

const assertPausableTarget = async (baseURL: string | undefined) => {
  if (!isIsolatedTarget(baseURL)) {
    throw new Error(`refusing to pause a server for base URL ${baseURL}: ${NOT_ISOLATED_REASON}`)
  }
  const { stdout } = await run('docker', ['inspect', ACCEPTANCE_CONTAINER, '--format', '{{json .HostConfig.PortBindings}}'])
  if (!stdout.includes(`"${ACCEPTANCE_PORT}"`)) {
    throw new Error(`refusing to pause ${ACCEPTANCE_CONTAINER}: it does not publish :${ACCEPTANCE_PORT} (${stdout.trim()})`)
  }
}

/**
 * Freeze the candidate's processes.
 *
 * `docker pause` rather than `stop`, deliberately: stopping would discard the
 * tmpfs database and restart the process, which resets exactly the state the
 * outage test exists to observe. A paused container keeps its sockets open and
 * its data intact — it simply stops answering.
 */
export const pauseAcceptanceServer = async (baseURL: string | undefined): Promise<void> => {
  await assertPausableTarget(baseURL)
  await run('docker', ['pause', ACCEPTANCE_CONTAINER])
}

/** Thaw the candidate and wait until it serves again. */
export const unpauseAcceptanceServer = async (baseURL: string | undefined): Promise<void> => {
  await assertPausableTarget(baseURL)
  const { stdout } = await run('docker', ['inspect', ACCEPTANCE_CONTAINER, '--format', '{{.State.Paused}}'])
  if (stdout.trim() === 'true') await run('docker', ['unpause', ACCEPTANCE_CONTAINER])
}

/** True while the container is frozen — used to make cleanup idempotent. */
export const isAcceptanceServerPaused = async (): Promise<boolean> => {
  const { stdout } = await run('docker', ['inspect', ACCEPTANCE_CONTAINER, '--format', '{{.State.Paused}}'])
  return stdout.trim() === 'true'
}

/**
 * Take the backend away for the duration of `body`.
 *
 * Two things are combined, and both are load-bearing:
 *
 *  - `docker pause` makes the *server* genuinely unable to answer, so nothing
 *    can quietly land while the test believes it is offline.
 *  - `context.setOffline(true)` makes the *client* fail fast. A paused
 *    container still completes the TCP handshake (the host-side proxy and the
 *    container's kernel are not frozen), so an un-emulated request black-holes
 *    for minutes instead of erroring. Without a prompt error the app never
 *    reaches its failure path: nothing is journalled, and a reload hangs
 *    forever because the service worker's cache fallback is keyed on `fetch`
 *    rejecting. Emulating the client-side partition reproduces what an actual
 *    caregiver's phone does when it loses the network.
 *
 * The server is restored *before* the clients come back online, so replay is
 * answered by a real, live backend rather than by a race.
 */
export const withServerOutage = async (
  baseURL: string | undefined,
  contexts: BrowserContext[],
  body: () => Promise<void>,
): Promise<void> => {
  await pauseAcceptanceServer(baseURL)
  for (const context of contexts) await context.setOffline(true)
  try {
    await body()
  } finally {
    await unpauseAcceptanceServer(baseURL)
    await waitForAcceptanceHealthy(baseURL)
    for (const context of contexts) await context.setOffline(false)
  }
}

export const waitForAcceptanceHealthy = async (baseURL: string | undefined): Promise<void> => {
  const target = `${(baseURL ?? `http://127.0.0.1:${ACCEPTANCE_PORT}`).replace(/\/$/, '')}/api/health`
  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      const response = await fetch(target, { cache: 'no-store' })
      if (response.ok) return
    } catch {
      // Still thawing; the loop below decides when to give up.
    }
    if (Date.now() > deadline) throw new Error(`acceptance server never became healthy at ${target}`)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

// ---------------------------------------------------------------------------
// Forensic ledger (IndexedDB)
// ---------------------------------------------------------------------------

export type JournalRecord = {
  id?: number
  at: string
  kind: 'state-write' | 'state-snapshot'
  reason: string
  status: number | null
  babyId: string | null
  clientId: string
  counts: Record<string, number>
  payload: unknown
}

/**
 * Read the append-only client journal straight out of IndexedDB.
 *
 * Opened without a version so the read can never trigger an upgrade: if the app
 * has not created the store yet there is simply nothing to report.
 */
export const readForensicJournal = (page: Page): Promise<JournalRecord[]> =>
  page.evaluate(() => new Promise<JournalRecord[]>((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open('baby-feeding-tracker-debug')
    } catch {
      resolve([])
      return
    }
    request.onerror = () => resolve([])
    request.onblocked = () => resolve([])
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('send-failures')) { db.close(); resolve([]); return }
      const all = db.transaction('send-failures', 'readonly').objectStore('send-failures').getAll()
      all.onsuccess = () => { resolve(all.result as JournalRecord[]); db.close() }
      all.onerror = () => { resolve([]); db.close() }
    }
  }) as Promise<JournalRecord[]>)

/**
 * Read a persisted collection straight out of a context's localStorage.
 *
 * Observation only — nothing here writes app state. It is what lets the
 * exactly-once assertion be made against each client's own copy of the truth
 * rather than only against what happens to be rendered.
 *
 * The app writes each collection twice: once under a key scoped to the active
 * baby and once under the legacy unscoped key it still mirrors for older
 * clients. The scoped key is the live one, so it is resolved explicitly —
 * matching on the suffix alone can return whichever the key iteration order
 * happened to reach first, and the mirror lags.
 */
export const readLocalCollection = (page: Page, suffix: string): Promise<Array<{ id: string } & Record<string, unknown>>> =>
  page.evaluate((keySuffix) => {
    const parse = (key: string | null) => {
      if (!key) return null
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : null
      } catch {
        return null
      }
    }
    const prefix = 'baby-feeding-tracker:v1:'
    const babyId = localStorage.getItem(`${prefix}selected-baby-id`)
    if (babyId) {
      const scoped = parse(`${prefix}baby:${encodeURIComponent(babyId)}${keySuffix}`)
      if (scoped) return scoped
    }
    return parse(`${prefix}${keySuffix.replace(/^:/, '')}`) ?? []
  }, suffix)

/** True while this client still has an unsynced local change queued. */
export const hasPendingLocalWork = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('baby-feeding-tracker:v1:pending-sync')
    if (raw === null) return false
    if (raw === '1') return true
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0
    } catch {
      return false
    }
  })

/** Journal entries whose captured payload still contains this record id. */
export const journalRecordsMentioning = (journal: JournalRecord[], id: string): JournalRecord[] =>
  journal.filter((record) => JSON.stringify(record.payload ?? null).includes(id))

// ---------------------------------------------------------------------------
// Failure artifacts
// ---------------------------------------------------------------------------

/** Attach JSON evidence to the report so a red run is diagnosable after the fact. */
export const attachJson = async (testInfo: TestInfo, name: string, body: unknown): Promise<void> => {
  await testInfo.attach(name, { body: JSON.stringify(body, null, 2), contentType: 'application/json' })
}

/** Capture API state, both clients' journals and screenshots for a failed run. */
export const captureFailureArtifacts = async (
  testInfo: TestInfo,
  request: Pick<APIRequestContext, 'get'>,
  pages: Record<string, Page>,
): Promise<void> => {
  if (testInfo.status === testInfo.expectedStatus) return
  try {
    await attachJson(testInfo, 'api-state.json', await readApiState(request))
  } catch (error) {
    await attachJson(testInfo, 'api-state-error.json', { error: String(error) })
  }
  for (const [name, page] of Object.entries(pages)) {
    if (page.isClosed()) continue
    try {
      await attachJson(testInfo, `journal-${name}.json`, await readForensicJournal(page))
      await testInfo.attach(`screenshot-${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    } catch (error) {
      await attachJson(testInfo, `artifact-error-${name}.json`, { error: String(error) })
    }
  }
}
