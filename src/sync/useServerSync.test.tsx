import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaperEvent, Entry, MedicineEvent, Session, Theme } from '../types'
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

class MockEventSource {
  static instances: MockEventSource[] = []
  onopen: null | (() => void) = null
  onerror: null | (() => void) = null
  listeners = new Map<string, (event: MessageEvent) => void>()
  closed = false

  url: string

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener)
  }

  emitState(data: unknown) {
    this.listeners.get('state')?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  close() {
    this.closed = true
  }
}

function Harness({ initialEntries = [] as Entry[] }) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [diapers, setDiapers] = useState<DiaperEvent[]>([])
  const [medicines, setMedicines] = useState<MedicineEvent[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [theme, setTheme] = useState<Theme>('light')
  const { syncStatus } = useServerSync({ entries, diapers, medicines, session, theme, setEntries, setDiapers, setMedicines, setSession, setTheme })

  return (
    <div>
      <span data-testid="status">{syncStatus}</span>
      <span data-testid="entries">{entries.map((item) => item.id).join(',')}</span>
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

  it('hydrates canonical server state from the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'v1' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('server'))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(fetchMock).toHaveBeenCalledWith('/api/state')
  })

  it('applies remote SSE state without echoing another write', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    fetchMock.mockClear()

    act(() => {
      MockEventSource.instances[0].emitState({ entries: [entry('remote', 4000)], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'v2' })
    })

    await waitFor(() => expect(screen.getByTestId('entries').textContent).toContain('remote'))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stays visually quiet when an already-synced SSE connection drops in the background', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
    expect(screen.getByTestId('status').textContent).toBe('synced')

    act(() => {
      MockEventSource.instances[0].onerror?.()
    })

    expect(screen.getByTestId('status').textContent).toBe('synced')
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull()
  })

  it('marks pending sync and retries local changes when offline', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'v1' }) })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ updatedAt: 'v2' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))

    await act(async () => {
      screen.getByRole('button', { name: 'add local' }).click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('offline'))
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBe('1')

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'))
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull()
  })
})
