import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  STORAGE_KEY,
  STORAGE_MEDICINES_KEY,
  setupAppTestEnvironment,
} from './appTestSetup'

describe('App interactions', () => {
  setupAppTestEnvironment()

  it('shows sync status to the left of the stats toggle', () => {
    render(<App />)

    const syncBadge = screen.getByLabelText(/Sync status: Online/i)
    const statsToggle = screen.getByRole('button', { name: /Show stats/i })

    expect(syncBadge.textContent).toBe('Online')
    expect(syncBadge.compareDocumentPosition(statsToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('quick logs medicine from a notification link after server hydration', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    window.history.replaceState({}, '', '/?quickMed=motrin')
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/notification-settings') return new Response(JSON.stringify({ available: false, gotifyRemindersEnabled: false }), { status: 200 })
      if (url === '/api/state' && !init?.method) {
        await new Promise((resolve) => window.setTimeout(resolve, 5))
        return new Response(JSON.stringify({ entries: [], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'server-1' }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true, updatedAt: 'server-2' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await vi.advanceTimersByTimeAsync(10)

    await waitFor(() => expect(screen.getByText(/Motrin logged/i)).toBeTruthy())
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
      expect(saved).toHaveLength(1)
      expect(saved[0].kind).toBe('motrin')
      expect(saved[0].at).toBeGreaterThanOrEqual(now)
    })
    expect(window.location.search).toBe('')
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('motrin'),
      }))
    })
  })

  it('hydrates saved server state without subscribing to live server events', async () => {
    class MockEventSource {
      static instance: MockEventSource | null = null
      url: string
      constructor(url: string) {
        this.url = url
        MockEventSource.instance = this
      }
      close = vi.fn()
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/notification-settings') return new Response(JSON.stringify({ available: false, gotifyRemindersEnabled: false }), { status: 200 })
      if (url === '/api/state' && !init?.method) return new Response(JSON.stringify({ entries: [], diapers: [], medicines: [], session: { startedAt: 1, activeSide: 'right', segments: [], bottleOunces: 0, note: '', diaperKinds: [] }, theme: 'light', updatedAt: 'server-1' }), { status: 200 })
      return new Response(JSON.stringify({ ok: true, updatedAt: 'server-write' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('EventSource', MockEventSource)

    render(<App />)

    await new Promise((resolve) => window.setTimeout(resolve, 10))
    expect(MockEventSource.instance).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' }))
    expect(screen.getByText(/On right/i)).toBeTruthy()
  })

  it('saves local changes back to the server without pending cross-browser sync banners', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/notification-settings') return new Response(JSON.stringify({ available: false, gotifyRemindersEnabled: false }), { status: 200 })
      if (String(input) === '/api/state' && !init?.method) return new Response(JSON.stringify({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-1' }), { status: 200 })
      return new Response(JSON.stringify({ ok: true, updatedAt: 'server-2' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    expect(screen.queryByText(/Offline changes saved/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(screen.getByRole('button', { name: /Log bottle-only feed/i }))
    await user.click(screen.getByRole('button', { name: /^log bottle$/i }))
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1)

    window.dispatchEvent(new Event('online'))
    await new Promise((resolve) => window.setTimeout(resolve, 10))
    expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' }))
  })
})
