import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { DiaperEvent, Entry, MedicineEvent, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'
import { useServerSync } from './useServerSync'

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

function Harness({ initialEntries = [] as Entry[], initialSession = null as Session | null, initialTummyTimes = [] as TummyTimeEvent[], initialGrowthMeasurements = [] as GrowthMeasurement[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [diapers, setDiapers] = useState<DiaperEvent[]>([])
  const [medicines, setMedicines] = useState<MedicineEvent[]>([])
  const [tummyTimes, setTummyTimes] = useState<TummyTimeEvent[]>(initialTummyTimes)
  const [tummySession, setTummySession] = useState<TummyTimeSession | null>(null)
  const [tummyGoalMinutes, setTummyGoalMinutes] = useState(20)
  const [growthMeasurements, setGrowthMeasurements] = useState<GrowthMeasurement[]>(initialGrowthMeasurements)
  const [babyDob, setBabyDob] = useState('2026-06-03')
  const [sessionState, setSession] = useState<Session | null>(initialSession)
  const [theme, setTheme] = useState<Theme>('light')
  const { syncStatus } = useServerSync({ entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session: sessionState, theme, setEntries, setDiapers, setMedicines, setTummyTimes, setTummySession, setTummyGoalMinutes, setGrowthMeasurements, setBabyDob, setSession, setTheme })

  return (
    <div>
      <span data-testid="status">{syncStatus}</span>
      <span data-testid="entries">{entries.map((item) => item.id).join(',')}</span>
      <span data-testid="session-note">{sessionState?.note ?? ''}</span>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={() => setEntries((prev) => [entry('local', 3000), ...prev])}>add local</button>
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
})
