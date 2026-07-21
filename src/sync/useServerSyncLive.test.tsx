import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, Session, Theme, TummyTimeEvent, TummyTimeSession } from '../types'
import type { GrowthMeasurement } from '../domain/growthTypes'
import { KEY_AUTH_TOKEN } from '../auth/authSession'
import { useServerSync } from './useServerSync'
import { CLIENT_ID } from './clientId'

const entry = (id: string, endedAt: number): Entry => ({ id, type: 'breast', startedAt: endedAt - 60_000, endedAt, leftSeconds: 60, rightSeconds: 0, bottleOunces: null, note: '' })

// A controllable fetch body that emits real SSE frames.
class MockSseStream {
  static instances: MockSseStream[] = []
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null
  private readonly encoder = new TextEncoder()
  readonly response: Response
  constructor() {
    this.response = new Response(new ReadableStream<Uint8Array>({ start: (controller) => { this.controller = controller } }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
    MockSseStream.instances.push(this)
  }
  emitState(payload: unknown) {
    this.controller?.enqueue(this.encoder.encode(`event: state\ndata: ${JSON.stringify(payload)}\n\n`))
  }
  close() { this.controller?.close() }
}

const liveStreamResponse = () => new MockSseStream().response

function Harness({ initialEntries = [] as Entry[], initialSession = null as Session | null, babyId }: { initialEntries?: Entry[]; initialSession?: Session | null; babyId?: string }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [diapers, setDiapers] = useState<DiaperEvent[]>([])
  const [medicines, setMedicines] = useState<MedicineEvent[]>([])
  const [tummyTimes, setTummyTimes] = useState<TummyTimeEvent[]>([])
  const [pumpEvents, setPumpEvents] = useState<PumpEvent[]>([])
  const [pumpSession, setPumpSession] = useState<import('../types').PumpSession | null>(null)
  const [tummySession, setTummySession] = useState<TummyTimeSession | null>(null)
  const [tummyGoalMinutes, setTummyGoalMinutes] = useState(20)
  const [growthMeasurements, setGrowthMeasurements] = useState<GrowthMeasurement[]>([])
  const [babyDob, setBabyDob] = useState('2026-06-03')
  const [sessionState, setSession] = useState<Session | null>(initialSession)
  const [theme, setTheme] = useState<Theme>('light')
  const { syncStatus, liveConflict, resolveLiveConflict } = useServerSync({ entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session: sessionState, theme, selectedBabyId: babyId, liveSyncEnabled: true, setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, setPumpSession, setTummySession, setTummyGoalMinutes, setGrowthMeasurements, setBabyDob, setSession, setTheme })

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

const loadResponse = (state: Record<string, unknown>) => new Response(JSON.stringify(state), { status: 200 })
const streamOrState = (state: Record<string, unknown>) => async (input: RequestInfo | URL, init?: RequestInit) => {
  void init
  return String(input).startsWith('/api/state/events') ? liveStreamResponse() : loadResponse(state)
}

describe('useServerSync live receive', () => {
  beforeEach(() => {
    localStorage.clear()
    MockSseStream.instances = []
  })
  afterEach(() => { cleanup(); MockSseStream.instances.forEach((stream) => stream.close()); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('opens an authenticated fetch stream and applies a newer remote snapshot for a quiescent viewer', async () => {
    localStorage.setItem(KEY_AUTH_TOKEN, 'test-bearer-token')
    const fetchMock = vi.fn(streamOrState({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }))
    vi.stubGlobal('fetch', fetchMock)
    render(<Harness babyId="baby a" />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))
    await waitFor(() => expect(MockSseStream.instances).toHaveLength(1))
    const streamCall = fetchMock.mock.calls.find(([input]) => input === '/api/state/events?babyId=baby%20a')
    expect(streamCall?.[1]).toEqual(expect.objectContaining({ cache: 'no-store' }))
    expect(new Headers(streamCall?.[1]?.headers).get('Authorization')).toBe('Bearer test-bearer-token')

    MockSseStream.instances[0].emitState({ entries: [entry('server', 2000), entry('wife-live', 5000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' })
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('wife-live'))
    expect(screen.getByTestId('conflict').textContent).toBe('no')
  })

  it('ignores our own echo and never regresses on an older snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(streamOrState({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' })))
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))
    await waitFor(() => expect(MockSseStream.instances).toHaveLength(1))

    MockSseStream.instances[0].emitState({ entries: [entry('echo', 9000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v3', origin: CLIENT_ID })
    MockSseStream.instances[0].emitState({ entries: [entry('older', 1000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByTestId('entries').textContent).toBe('server')
  })

  it('holds a remote update as a conflict when local work is unsaved', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/state/events')) return liveStreamResponse()
      if (!init || init.method !== 'PUT') return loadResponse({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' })
      return new Promise<Response>(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))
    await waitFor(() => expect(MockSseStream.instances).toHaveLength(1))

    screen.getByRole('button', { name: 'add local' }).click()
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('local'))
    MockSseStream.instances[0].emitState({ entries: [entry('server', 2000), entry('wife-live', 5000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' })
    await waitFor(() => expect(screen.getByTestId('conflict').textContent).toBe('yes'))
    expect(screen.getByTestId('entries').textContent).not.toContain('wife-live')
  })

  it('adopts the other device when the user chooses "use theirs"', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/state/events')) return liveStreamResponse()
      if (!init || init.method !== 'PUT') return loadResponse({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' })
      return new Promise<Response>(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toBe('server'))
    await waitFor(() => expect(MockSseStream.instances).toHaveLength(1))

    screen.getByRole('button', { name: 'add local' }).click()
    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('local'))
    MockSseStream.instances[0].emitState({ entries: [entry('wife-live', 5000)], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v2' })
    await waitFor(() => expect(screen.getByTestId('conflict').textContent).toBe('yes'))

    screen.getByRole('button', { name: 'use theirs' }).click()
    await waitFor(() => expect(screen.getByTestId('conflict').textContent).toBe('no'))
    expect(screen.getByTestId('entries').textContent).toBe('wife-live')
  })
})
