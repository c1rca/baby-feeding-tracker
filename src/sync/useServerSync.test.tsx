import { cleanup, render, screen } from '@testing-library/react'
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
  url: string

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  close() {}
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

  it('does not hydrate from the server or subscribe to live state events', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [entry('server', 2000)], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'v1' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.getByTestId('entries').textContent).toBe('')
    expect(screen.getByTestId('status').textContent).toBe('synced')
    expect(fetchMock).not.toHaveBeenCalledWith('/api/state')
    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('does not write local changes to the shared server state or mark pending sync', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updatedAt: 'v2' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)
    screen.getByRole('button', { name: 'add local' }).click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.getByTestId('entries').textContent).toContain('local')
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' }))
  })
})
