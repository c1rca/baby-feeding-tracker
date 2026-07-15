import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaperEvent, Entry, MedicineEvent, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'
import type { GrowthMeasurement } from '../domain/growthTypes'
import { useServerSync } from './useServerSync'
import { CLIENT_ID } from './clientId'

const entry = (id: string, endedAt: number): Entry => ({ id, type: 'breast', startedAt: endedAt - 60_000, endedAt, leftSeconds: 60, rightSeconds: 0, bottleOunces: null, note: '' })

// EventSource mock that records instances and lets a test push server frames.
class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  listeners: Record<string, Array<(event: MessageEvent) => void>> = {}
  constructor(url: string) { this.url = url; MockEventSource.instances.push(this) }
  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(handler)
  }
  emitState(payload: unknown) {
    for (const handler of this.listeners.state ?? []) handler({ data: JSON.stringify(payload) } as MessageEvent)
  }
  close() {}
}

function Harness({ initialEntries = [] as Entry[], initialSession = null as Session | null }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [diapers, setDiapers] = useState<DiaperEvent[]>([])
  const [medicines, setMedicines] = useState<MedicineEvent[]>([])
  const [tummyTimes, setTummyTimes] = useState<TummyTimeEvent[]>([])
  const [tummySession, setTummySession] = useState<TummyTimeSession | null>(null)
  const [tummyGoalMinutes, setTummyGoalMinutes] = useState(20)
  const [growthMeasurements, setGrowthMeasurements] = useState<GrowthMeasurement[]>([])
  const [babyDob, setBabyDob] = useState('2026-06-03')
  const [sessionState, setSession] = useState<Session | null>(initialSession)
  const [theme, setTheme] = useState<Theme>('light')
  const { syncStatus, liveConflict, resolveLiveConflict } = useServerSync({ entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session: sessionState, theme, liveSyncEnabled: true, setEntries, setDiapers, setMedicines, setTummyTimes, setTummySession, setTummyGoalMinutes, setGrowthMeasurements, setBabyDob, setSession, setTheme })

  return (
    <div>
      <span data-testid="status">{syncStatus}</span>
      <span data-testid="entries">{entries.map((item) => item.id).join(',')}</span>
      <span data-testid="conflict">{liveConflict ? 'yes' : 'no'}</span>
      <button type="button" onClick={() => setEntries((prev) => [entry('local', 3000), ...prev])}>add local</button>
      <button type="button" onClick={() => resolveLiveConflict('theirs')}>use theirs</button>
      <button type="button" onClick={() => resolveLiveConflict('mine')}>keep mine</button>
    </div>
  )
}

const loadResponse = (state: Record<string, unknown>) => ({ ok: true, json: async () => state })

describe('useServerSync live receive', () => {
  beforeEach(() => {
    localStorage.clear()
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('opens a live subscription and applies a newer remote snapshot for a quiescent viewer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(loadResponse({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' })))
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))
    expect(MockEventSource.instances).toHaveLength(1)

    // A live update from the other device arrives while we are just viewing.
    MockEventSource.instances[0].emitState({ entries: [entry('server', 2000), entry('wife-live', 5000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' })

    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('wife-live'))
    expect(screen.getByTestId('conflict').textContent).toBe('no')
  })

  it('ignores our own echo (same client id) and never regresses on an older snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(loadResponse({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' })))
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))

    // Our own broadcast echo — must be ignored.
    MockEventSource.instances[0].emitState({ entries: [entry('echo', 9000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v3', origin: CLIENT_ID })
    // An older snapshot — must not regress.
    MockEventSource.instances[0].emitState({ entries: [entry('older', 1000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByTestId('entries').textContent).toBe('server')
  })

  it('does not overwrite unsaved local work — it holds the update as a conflict the user resolves', async () => {
    // GET resolves; PUT hangs so the local change stays pending (not quiescent).
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return loadResponse({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' })
      return new Promise(() => {}) // never resolves — keeps us non-quiescent
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))

    screen.getByRole('button', { name: 'add local' }).click()
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('local'))

    // Remote update lands while we have unsaved local work: held, not applied.
    MockEventSource.instances[0].emitState({ entries: [entry('server', 2000), entry('wife-live', 5000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' })
    await waitFor(() => expect(screen.getByTestId('conflict').textContent).toBe('yes'))
    expect(screen.getByTestId('entries').textContent).not.toContain('wife-live')
    expect(screen.getByTestId('entries').textContent).toContain('local')

    // Keep mine: local work preserved, banner dismissed.
    screen.getByRole('button', { name: 'keep mine' }).click()
    await waitFor(() => expect(screen.getByTestId('conflict').textContent).toBe('no'))
    expect(screen.getByTestId('entries').textContent).toContain('local')
  })

  it('adopts the other device when the user chooses "use theirs"', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method !== 'PUT') return loadResponse({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' })
      return new Promise(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))

    screen.getByRole('button', { name: 'add local' }).click()
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('local'))
    MockEventSource.instances[0].emitState({ entries: [entry('wife-live', 5000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' })
    await waitFor(() => expect(screen.getByTestId('conflict').textContent).toBe('yes'))

    screen.getByRole('button', { name: 'use theirs' }).click()
    await waitFor(() => expect(screen.getByTestId('conflict').textContent).toBe('no'))
    expect(screen.getByTestId('entries').textContent).toBe('wife-live')
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull()
  })
})
