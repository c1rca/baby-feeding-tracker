import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, HealthRecord, MedicineEvent, PumpEvent, Session, Theme, TummyTimeEvent, TummyTimeSession, CustomTracker, CustomEvent } from '../types'
import { useServerSync } from './useServerSync'
import { hasPendingSyncForBaby } from './serverSyncTypes'
import { SYNC_DEBOUNCE_MS } from './useServerSyncEffects'

const putCalls = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.filter((call) => call[1]?.method === 'PUT')

const serverPumpForStatus: PumpEvent = { id: 'server-pump', startedAt: 1000, endedAt: 2000, leftOunces: 2, rightOunces: 1, note: 'remote' }

const entry = (id: string, endedAt: number): Entry => ({
  id,
  type: 'breast',
  startedAt: endedAt - 60_000,
  endedAt,
  leftSeconds: 60,
  rightSeconds: 0,
  bottleOunces: null,
  note: '',
})

const session = (startedAt: number, note = ''): Session => ({
  id: `session-${startedAt}`,
  startedAt,
  activeSide: 'left',
  segmentStart: startedAt,
  segments: [],
  bottleOunces: 0,
  note,
  diaperKinds: [],
})

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  close() {}
}

function Harness({ initialEntries = [] as Entry[], initialSession = null as Session | null, initialTummyTimes = [] as TummyTimeEvent[], initialPumpEvents = [] as PumpEvent[], initialGrowthMeasurements = [] as GrowthMeasurement[], selectedBabyId = undefined as string | undefined }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [diapers, setDiapers] = useState<DiaperEvent[]>([])
  const [medicines, setMedicines] = useState<MedicineEvent[]>([])
  const [tummyTimes, setTummyTimes] = useState<TummyTimeEvent[]>(initialTummyTimes)
  const [pumpEvents, setPumpEvents] = useState<PumpEvent[]>(initialPumpEvents)
  const [pumpSession, setPumpSession] = useState<import('../types').PumpSession | null>(null)
  const [tummySession, setTummySession] = useState<TummyTimeSession | null>(null)
  const [tummyGoalMinutes, setTummyGoalMinutes] = useState(20)
  const [pumpGoalOunces, setPumpGoalOunces] = useState(0)
  const [pumpGoalSessions, setPumpGoalSessions] = useState(0)
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [customTrackers, setCustomTrackers] = useState<CustomTracker[]>([])
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([])
  const [growthMeasurements, setGrowthMeasurements] = useState<GrowthMeasurement[]>(initialGrowthMeasurements)
  const [babyDob, setBabyDob] = useState('2026-06-03')
  const [sessionState, setSession] = useState<Session | null>(initialSession)
  const [theme, setTheme] = useState<Theme>('light')
  const { syncStatus } = useServerSync({ entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, customTrackers, customEvents, babyDob, session: sessionState, theme, selectedBabyId, setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, setPumpSession, setTummySession, setTummyGoalMinutes, setPumpGoalOunces, setPumpGoalSessions, setGrowthMeasurements, setHealthRecords, setCustomTrackers, setCustomEvents, setBabyDob, setSession, setTheme })
  return (
    <div>
      <span data-testid="status">{syncStatus}</span>
      <span data-testid="entries">{entries.map((item) => item.id).join(',')}</span>
      <span data-testid="session-note">{sessionState?.note ?? ''}</span>
      <span data-testid="theme">{theme}</span>
      <span data-testid="tummy-session">{tummySession?.id ?? ''}</span>
      <span data-testid="pump-events">{pumpEvents.map((item) => item.id).join(',')}</span>
      <button type="button" onClick={() => setEntries((prev) => [entry('local', 3000), ...prev])}>add local</button>
      <span data-testid="pump-goal-oz">{pumpGoalOunces}</span>
      <span data-testid="health-count">{healthRecords.length}</span>
      <button type="button" onClick={() => setHealthRecords((prev) => [...prev, { id: `hr-${prev.length}`, kind: 'vaccine', name: 'Probe', at: 1000 } as HealthRecord])}>add health record</button>
      <button type="button" onClick={() => setPumpGoalOunces(24)}>set pump goal</button>
      <span data-testid="custom-trackers">{customTrackers.map((item) => `${item.name}:${item.goal.kind}`).join(',')}</span>
      <button type="button" onClick={() => setCustomTrackers((prev) => [...prev, { id: 'ct-1', name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'count', target: 3 }, createdAt: 1000, archivedAt: null }])}>add custom tracker</button>
      <button type="button" onClick={() => setCustomTrackers((prev) => prev.map((item) => ({ ...item, name: 'Vitamin D' })))}>rename custom tracker</button>
      <button type="button" onClick={() => setTummySession({ id: 'sleep-1', startedAt: 1000, runningStartedAt: 1000, elapsedSeconds: 0, note: '', kind: 'sleep' })}>start sleep</button>
    </div>
  )
}

describe('useServerSync', () => {
  beforeEach(() => {
    localStorage.clear()
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hydrates timeline data from the server without subscribing to live state events', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'v1' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('status').textContent).toBe('synced')
    expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' }))
    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('hydrates pumping history and preserves it in an unrelated current-state sync', async () => {
    const serverPump: PumpEvent = { id: 'server-pump', startedAt: 1000, endedAt: 2000, leftOunces: 2, rightOunces: 1, note: 'remote' }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [serverPump], session: null, theme: 'light', updatedAt: 'v1' }) }
      const body = JSON.parse(String(init.body))
      return { ok: true, json: async () => ({ updatedAt: 'v2', state: { ...body, updatedAt: 'v2' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('pump-events').textContent).toBe('server-pump'))
    screen.getByRole('button', { name: 'add local' }).click()
    await waitFor(() => expect(putCalls(fetchMock)).toHaveLength(1))

    const body = JSON.parse(String(putCalls(fetchMock)[0][1]?.body))
    expect(body.pumpEvents).toEqual([serverPump])
  })

  it('preserves a local edit made during the initial load window (start-during-hydration data loss)', async () => {
    // Reproduces the "started sleep / added an entry and it vanished a few
    // seconds later" report: a mutation made while the initial GET is still in
    // flight must not be discarded when the server snapshot lands.
    let resolveGet: () => void = () => {}
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return { ok: true, json: async () => ({ updatedAt: 'server-merged', state: { ...body, updatedAt: 'server-merged' } }) }
      }
      return await new Promise((resolve) => {
        resolveGet = () => resolve({ ok: true, json: async () => ({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-v1' }) })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    // The initial GET is outstanding; the user adds an entry before hydration.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' })))
    screen.getByRole('button', { name: 'add local' }).click()
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('local'))

    // Hydration completes.
    await act(async () => {
      resolveGet()
      await Promise.resolve()
    })

    // The in-flight local edit must survive, merged with the server snapshot.
    await waitFor(() => {
      const ids = screen.getByTestId('entries').textContent ?? ''
      expect(ids).toContain('local')
      expect(ids).toContain('server')
    })
  })

  it('keeps a sleep timer started during the initial load window from vanishing', async () => {
    // The exact reported bug: a sleep timer started right after opening the app
    // "suddenly stopped" a few seconds later when the server snapshot (which had
    // no active care session) landed and overwrote it.
    let resolveGet: () => void = () => {}
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return { ok: true, json: async () => ({ updatedAt: 'server-merged', state: { ...body, updatedAt: 'server-merged' } }) }
      }
      return await new Promise((resolve) => {
        resolveGet = () => resolve({ ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], tummySession: null, session: null, theme: 'light', updatedAt: 'server-v1' }) })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' })))
    screen.getByRole('button', { name: 'start sleep' }).click()
    await waitFor(() => expect(screen.getByTestId('tummy-session').textContent).toBe('sleep-1'))

    await act(async () => {
      resolveGet()
      await Promise.resolve()
    })

    // The running sleep session must still be active after hydration, and the
    // merge PUT must carry it up to the server.
    await waitFor(() => expect(screen.getByTestId('tummy-session').textContent).toBe('sleep-1'))
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(String(putCall?.[1]?.body)).tummySession?.id).toBe('sleep-1')
  })

  it('merges a timer mutation when the initial response lands in the same React turn', async () => {
    let resolveGet: () => void = () => {}
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return { ok: true, json: async () => ({ updatedAt: 'server-merged', state: { ...body, updatedAt: 'server-merged' } }) }
      }
      return await new Promise((resolve) => {
        resolveGet = () => resolve({ ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], tummySession: null, session: null, theme: 'light', updatedAt: 'server-v1' }) })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' })))
    await act(async () => {
      screen.getByRole('button', { name: 'start sleep' }).click()
      resolveGet()
      await Promise.resolve()
    })

    await waitFor(() => expect(screen.getByTestId('tummy-session').textContent).toBe('sleep-1'))
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(String(putCall?.[1]?.body)).tummySession?.id).toBe('sleep-1')
  })

  it('refreshes from the server before replaying pending local changes', async () => {
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync', '1')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [entry('wife-entry', 4000)], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'server-new' }) }
      return { ok: true, json: async () => ({ updatedAt: 'server-merged', staleWriteMerged: true, state: { entries: [entry('wife-entry', 4000), entry('local-pending', 3000)], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'server-merged' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness initialEntries={[entry('local-pending', 3000)]} />)

    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('wife-entry,local-pending'))
    expect(fetchMock.mock.calls[0]).toEqual(['/api/state', expect.objectContaining({ cache: 'no-store' })])
    expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' }))
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull()
  })

  it('does not replay a pending change queued for another baby into the current baby', async () => {
    // Baby A has an unsynced offline change; we mount for baby B.
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync', '1')
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync-baby', 'baby-A')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [entry('baby-b-server', 6000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-b' }) }
      return { ok: true, json: async () => ({ updatedAt: 'server-merged', state: JSON.parse(String(init.body)) }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness initialEntries={[entry('baby-a-pending', 3000)]} selectedBabyId="baby-B" />)

    // Baby B's server state loads, and baby A's pending payload is never PUT.
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('baby-b-server'))
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(false)
    // Baby A's pending flag is preserved for when the user switches back, but
    // the currently loaded baby should not claim it is offline.
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBe('1')
    expect(screen.getByTestId('status').textContent).toBe('synced')
  })

  it('a successful sync on baby B preserves baby A unsynced offline change (B1 data-loss regression)', async () => {
    // Baby A queued an offline change; we open baby B and sync a fresh edit on B.
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync', '1')
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync-baby', 'baby-A')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [entry('baby-b-server', 6000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-b' }) }
      return { ok: true, json: async () => ({ updatedAt: 'server-b2', state: JSON.parse(String(init.body)) }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness selectedBabyId="baby-B" />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('baby-b-server'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Baby B writes a local change, which syncs successfully and clears B only.
    screen.getByRole('button', { name: 'add local' }).click()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' })))

    // Baby A's pending marker must survive B's successful sync.
    expect(hasPendingSyncForBaby('baby-A')).toBe(true)
    expect(hasPendingSyncForBaby('baby-B')).toBe(false)
  })

  it('replays pending local tummy time and growth changes without dropping server-side records', async () => {
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync', '1')
    const serverTummyTime: TummyTimeEvent = { id: 'server-tummy', startedAt: 5000, endedAt: 5600, note: 'server' }
    const localTummyTime: TummyTimeEvent = { id: 'local-tummy', startedAt: 3000, endedAt: 3600, note: 'local' }
    const serverGrowth: GrowthMeasurement = { id: 'server-growth', measuredAt: 5000, ageMonths: 0.5, weightLb: 8, lengthCm: null, headCm: null }
    const localGrowth: GrowthMeasurement = { id: 'local-growth', measuredAt: 3000, ageMonths: 0.5, weightLb: 7.5, lengthCm: null, headCm: null }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [serverTummyTime], tummySession: null, growthMeasurements: [serverGrowth], babyDob: '2026-06-03', session: null, theme: 'light', updatedAt: 'server-new' }) }
      return { ok: true, json: async () => ({ updatedAt: 'server-merged', state: JSON.parse(String(init.body)) }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness initialTummyTimes={[localTummyTime]} initialGrowthMeasurements={[localGrowth]} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' })))
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    const payload = JSON.parse(String(putCall?.[1]?.body))
    expect(payload.tummyTimes.map((item: TummyTimeEvent) => item.id).sort()).toEqual(['local-tummy', 'server-tummy'])
    expect(payload.growthMeasurements.map((item: GrowthMeasurement) => item.id).sort()).toEqual(['local-growth', 'server-growth'])
  })

  it('preserves server session when replaying pending local changes', async () => {
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync', '1')
    const serverSession = session(5000, 'server-session')
    const localSession = session(1000, 'local-stale-session')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], session: serverSession, theme: 'light', updatedAt: 'server-new' }) }
      return { ok: true, json: async () => ({ updatedAt: 'server-merged', state: { entries: [], diapers: [], medicines: [], session: serverSession, theme: 'light', updatedAt: 'server-merged' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness initialSession={localSession} />)

    await waitFor(() => expect(screen.getByTestId('session-note').textContent).toBe('server-session'))
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(String(putCall?.[1]?.body)).session.note).toBe('server-session')
  })

  it('replays pending local session when the server has no active session', async () => {
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync', '1')
    const localSession = session(1000, 'local-session')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-new' }) }
      return { ok: true, json: async () => ({ updatedAt: 'server-merged', state: { entries: [], diapers: [], medicines: [], session: localSession, theme: 'light', updatedAt: 'server-merged' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness initialSession={localSession} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' })))
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(String(putCall?.[1]?.body)).session.note).toBe('local-session')
  })

  it('coalesces a burst of local edits into a single debounced PUT', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }) }
      return { ok: true, json: async () => ({ updatedAt: 'v2' }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' })))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const button = screen.getByRole('button', { name: 'add local' })
    button.click()
    button.click()
    button.click()

    await waitFor(() => expect(putCalls(fetchMock).length).toBe(1))
    // No further PUT should land after the debounce window fully elapses.
    await new Promise((resolve) => setTimeout(resolve, SYNC_DEBOUNCE_MS + 100))
    expect(putCalls(fetchMock).length).toBe(1)
  })

  // Regression: a local edit made while a PUT was in flight used to clear the
  // known server revision, so the replay carrying that edit arrived with no
  // revision at all. The server reads a revision-less write as stale, and its
  // stale path keeps its own session/goals and discards the client's — so the
  // very edit the replay existed to deliver was thrown away, and the client
  // then adopted the reverted response. Resuming a paused timer, or undoing a
  // cleared feed, on a slow connection silently undid itself.
  it('replays a mid-write local edit with the acknowledged revision, not a stale one', async () => {
    const serverPump: PumpEvent = { id: 'server-pump', startedAt: 1000, endedAt: 2000, leftOunces: 2, rightOunces: 1, note: 'remote' }
    let releasePut: (() => void) | null = null
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') {
        return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [serverPump], session: null, theme: 'light', updatedAt: 'v1' }) }
      }
      const body = JSON.parse(String(init.body))
      if (putCalls(fetchMock).length === 1) {
        // Hold the first PUT open so the next local edit lands mid-write.
        await new Promise<void>((resolve) => { releasePut = resolve })
      }
      return { ok: true, json: async () => ({ updatedAt: 'v2', state: { ...body, updatedAt: 'v2' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('pump-events').textContent).toBe('server-pump'))

    await act(async () => { screen.getByRole('button', { name: 'add health record' }).click() })
    await waitFor(() => expect(putCalls(fetchMock).length).toBe(1))

    // A second edit while the first write is still open.
    await act(async () => { screen.getByRole('button', { name: 'add local' }).click() })
    await new Promise((resolve) => setTimeout(resolve, SYNC_DEBOUNCE_MS + 50))
    await act(async () => { releasePut?.() })

    await waitFor(() => expect(putCalls(fetchMock).length).toBe(2))
    const replay = JSON.parse(String(putCalls(fetchMock)[1][1]?.body))
    expect(replay.updatedAt, 'the replay must carry the acknowledged revision so the server does not treat it as stale').toBe('v2')
    expect(replay.entries.map((item: Entry) => item.id)).toContain('local')
  })

  // A write the server will never accept must not read as "Offline changes
  // saved". The whole-state payload has a hard size ceiling, and when a
  // household eventually crosses it every write is rejected — permanently. The
  // status pill said the same reassuring thing it says for a tunnel outage, so
  // sync would die silently and stay dead.
  it.each([
    [413, 'issue'],
    [400, 'issue'],
    [403, 'issue'],
  ])('surfaces a %i rejection as a sync issue, not as offline', async (status, expected) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') {
        return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [serverPumpForStatus], session: null, theme: 'light', updatedAt: 'v1' }) }
      }
      return { ok: false, status, json: async () => ({ ok: false }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('pump-events').textContent).toBe('server-pump'))
    await act(async () => { screen.getByRole('button', { name: 'add local' }).click() })

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe(expected))
  })

  // A transient failure still has to read as offline: it will succeed later and
  // the queued change is genuinely safe.
  it.each([[503], [429], [408]])('keeps a %i failure reading as offline', async (status) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') {
        return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [serverPumpForStatus], session: null, theme: 'light', updatedAt: 'v1' }) }
      }
      return { ok: false, status, json: async () => ({ ok: false }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('pump-events').textContent).toBe('server-pump'))
    await act(async () => { screen.getByRole('button', { name: 'add local' }).click() })

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('offline'))
  })

  it('never runs two syncs concurrently (single-flight serialization)', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }) }
      concurrent += 1
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((resolve) => setTimeout(resolve, 100))
      concurrent -= 1
      return { ok: true, json: async () => ({ updatedAt: 'v2' }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' })))
    await new Promise((resolve) => setTimeout(resolve, 0))

    screen.getByRole('button', { name: 'add local' }).click()
    // Once the first PUT is in flight, a focus/online retry requests another
    // sync; single-flight must defer it rather than run it concurrently.
    await waitFor(() => expect(putCalls(fetchMock).length).toBe(1))
    window.dispatchEvent(new Event('online'))

    await waitFor(() => expect(putCalls(fetchMock).length).toBeGreaterThanOrEqual(2))
    expect(maxConcurrent).toBe(1)
  })

  it('writes local changes back to the server state without opening a live subscription', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-1' }) }
      return { ok: true, json: async () => ({ updatedAt: 'server-2' }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' })))
    await new Promise((resolve) => setTimeout(resolve, 0))
    screen.getByRole('button', { name: 'add local' }).click()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' })))
    const putCall = [...fetchMock.mock.calls].reverse().find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(String(putCall?.[1]?.body)).entries[0].id).toBe('local')
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull()
    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('fast-forwards a quiet tab to newer server state when it regains focus', async () => {
    let getCount = 0
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return { ok: true, json: async () => ({ updatedAt: 'v-put' }) }
      getCount += 1
      if (getCount === 1) return { ok: true, json: async () => ({ entries: [entry('server-1', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }) }
      return { ok: true, json: async () => ({ entries: [entry('server-2', 5000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server-1'))

    // A backgrounded tab returning to the foreground pulls the latest snapshot.
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server-2'))
    expect(putCalls(fetchMock).length).toBe(0)
  })

  it('coalesces a focus + visibility burst into a single background pull', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return { ok: true, json: async () => ({ updatedAt: 'v-put' }) }
      return { ok: true, json: async () => ({ entries: [entry('server-1', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server-1'))
    const getsAfterLoad = fetchMock.mock.calls.filter((call) => call[1]?.method !== 'PUT').length

    // Returning to a tab fires focus and visibilitychange together; the throttle
    // must collapse them into one fetch, not a thundering herd.
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const getsAfterBurst = fetchMock.mock.calls.filter((call) => call[1]?.method !== 'PUT').length
    expect(getsAfterBurst - getsAfterLoad).toBe(1)
  })

  it('never overwrites unsaved local work with a background pull', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return { ok: true, json: async () => ({ updatedAt: 'v-put', state: JSON.parse(String(init.body)) }) }
      return { ok: true, json: async () => ({ entries: [entry('server-only', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server-only'))
    const getsAfterLoad = fetchMock.mock.calls.filter((call) => call[1]?.method !== 'PUT').length

    // Simulate unsaved local work queued for this baby. The read-only pull must
    // stand down entirely (no GET, no apply) and leave reconciliation to the
    // push path, so an in-progress edit is never clobbered by a stale fetch.
    localStorage.setItem('baby-feeding-tracker:v1:pending-sync', '1')
    window.dispatchEvent(new Event('focus'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const getsAfterFocus = fetchMock.mock.calls.filter((call) => call[1]?.method !== 'PUT').length
    expect(getsAfterFocus).toBe(getsAfterLoad)
    expect(screen.getByTestId('entries').textContent).toBe('server-only')
  })

  // Regression: health records had no writer of their own on this branch — the
  // debounced whole-state PUT is the only one — and they were missing from its
  // deps, so an immunisation or milestone stayed on the device until some
  // unrelated change happened to carry it, and was lost if the client hydrated
  // from the server first.
  it('sends a PUT when a health record is added', async () => {
    const serverPump: PumpEvent = { id: 'server-pump', startedAt: 1000, endedAt: 2000, leftOunces: 2, rightOunces: 1, note: 'remote' }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [serverPump], session: null, theme: 'light', updatedAt: 'v1' }) }
      const body = JSON.parse(String(init.body))
      return { ok: true, json: async () => ({ updatedAt: 'v2', state: { ...body, updatedAt: 'v2' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('pump-events').textContent).toBe('server-pump'))

    await act(async () => { screen.getByRole('button', { name: 'add health record' }).click() })
    expect(screen.getByTestId('health-count').textContent).toBe('1')

    await waitFor(() => expect(putCalls(fetchMock).length).toBeGreaterThan(0))
    expect(JSON.parse(String(putCalls(fetchMock).at(-1)![1]?.body)).healthRecords).toHaveLength(1)
  })

  // Regression: the pump goals are the only synced fields with no writer of
  // their own — this debounced full-state PUT is all that persists them. When
  // they were left out of usePersistLocalChanges' deps upstream, editing a goal
  // produced zero PUTs and the change silently vanished on reload.
  it('sends a PUT carrying the new value when a pump goal changes', async () => {
    const serverPump: PumpEvent = { id: 'server-pump', startedAt: 1000, endedAt: 2000, leftOunces: 2, rightOunces: 1, note: 'remote' }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [serverPump], session: null, theme: 'light', updatedAt: 'v1' }) }
      const body = JSON.parse(String(init.body))
      return { ok: true, json: async () => ({ updatedAt: 'v2', state: { ...body, updatedAt: 'v2' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    // Wait for hydration to actually land before editing, so the write below is
    // unambiguously the goal change rather than the initial sync.
    await waitFor(() => expect(screen.getByTestId('pump-events').textContent).toBe('server-pump'))

    await act(async () => { screen.getByRole('button', { name: 'set pump goal' }).click() })
    expect(screen.getByTestId('pump-goal-oz').textContent).toBe('24')

    await waitFor(() => expect(putCalls(fetchMock).length).toBeGreaterThan(0))
    expect(JSON.parse(String(putCalls(fetchMock).at(-1)![1]?.body)).pumpGoalOunces).toBe(24)
  })

  // A tracker definition is only ever written by this debounced whole-state PUT
  // — the same shape that silently dropped pump goals and health records. A
  // definition that does not leave the device is worse than one that never
  // existed: the caregiver on the other phone sees a need nobody told them about.
  it('sends a PUT carrying a custom tracker when one is created, and again when it is edited', async () => {
    const serverPump: PumpEvent = { id: 'server-pump', startedAt: 1000, endedAt: 2000, leftOunces: 2, rightOunces: 1, note: 'remote' }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return { ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], tummyTimes: [], pumpEvents: [serverPump], session: null, theme: 'light', updatedAt: 'v1' }) }
      const body = JSON.parse(String(init.body))
      return { ok: true, json: async () => ({ updatedAt: 'v2', state: { ...body, updatedAt: 'v2' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('pump-events').textContent).toBe('server-pump'))

    await act(async () => { screen.getByRole('button', { name: 'add custom tracker' }).click() })
    await waitFor(() => expect(putCalls(fetchMock).length).toBeGreaterThan(0))
    const created = JSON.parse(String(putCalls(fetchMock).at(-1)![1]?.body)).customTrackers
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'count', target: 3 } })

    const afterCreate = putCalls(fetchMock).length
    await act(async () => { screen.getByRole('button', { name: 'rename custom tracker' }).click() })
    await waitFor(() => expect(putCalls(fetchMock).length).toBeGreaterThan(afterCreate))
    expect(JSON.parse(String(putCalls(fetchMock).at(-1)![1]?.body)).customTrackers[0].name).toBe('Vitamin D')
  })

  // The receive half of the same story: the other caregiver's phone defined it.
  it('hydrates a custom tracker defined on another device', async () => {
    const remote: CustomTracker = { id: 'ct-remote', name: 'Physio', icon: 'dumbbell', hue: 'tummy', goal: { kind: 'duration', targetMinutes: 15 }, createdAt: 500, archivedAt: null }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], customTrackers: [remote], customEvents: [], session: null, theme: 'light', updatedAt: 'v1' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('custom-trackers').textContent).toBe('Physio:duration'))
  })

})
