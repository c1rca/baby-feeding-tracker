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

  it('keeps healthy sync status quiet', () => {
    render(<App />)
    expect(screen.queryByLabelText(/Sync status: Online/i)).toBeNull()
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

  it('hydrates saved server state and opens the live event subscription by default', async () => {
    class MockEventSource {
      static instance: MockEventSource | null = null
      url: string
      addEventListener = vi.fn()
      close = vi.fn()
      constructor(url: string) {
        this.url = url
        MockEventSource.instance = this
      }
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
    expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' }))
    expect(screen.getByText(/On right/i)).toBeTruthy()
    // Live sync is ON by default, so a read-only event subscription is opened.
    expect(MockEventSource.instance).not.toBeNull()
    expect(MockEventSource.instance?.url).toContain('/api/state/events')
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
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1)

    // The write is debounced; once it lands the pending marker clears and the
    // online save never surfaces an offline banner.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ method: 'PUT' })))
    await waitFor(() => expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull())
    expect(screen.queryByText(/Offline changes saved/i)).toBeNull()
  })

  it('switches babies and hydrates the selected baby with the scope header', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const babyId = new Headers(init?.headers).get('x-baby-id')
      if (url === '/api/auth/me') return new Response(JSON.stringify({ ok: true, user: { id: 'user-1', householdId: 'household-1', babyId: 'baby-1', role: 'caregiver', mode: 'session' } }), { status: 200 })
      if (url === '/api/babies') return new Response(JSON.stringify({ ok: true, babies: [
        { id: 'baby-1', name: 'Avery', dob: '2026-01-01' },
        { id: 'baby-2', name: 'Riley', dob: '2026-02-14' },
      ] }), { status: 200 })
      if (url === '/api/notification-settings') return new Response(JSON.stringify({ available: false, gotifyRemindersEnabled: false }), { status: 200 })
      if (url === '/api/state' && !init?.method) {
        return new Response(JSON.stringify({ entries: babyId === 'baby-2' ? [{ id: 'feed-riley', type: 'bottle', startedAt: Date.now(), endedAt: Date.now(), ounces: 3 }] : [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: `server-${babyId || 'default'}` }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true, updatedAt: 'server-write' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const babySelect = await screen.findByLabelText(/Active baby/i)
    expect((babySelect as HTMLSelectElement).value).toBe('baby-1')

    await user.selectOptions(babySelect, 'baby-2')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({
        cache: 'no-store',
        headers: { 'X-Baby-Id': 'baby-2' },
      }))
    })
    expect(localStorage.getItem('baby-feeding-tracker:v1:selected-baby-id')).toBe('baby-2')
    await waitFor(() => {
      const scopedEntries = JSON.parse(localStorage.getItem('baby-feeding-tracker:v1:baby:baby-2:entries') ?? '[]') as Array<{ id: string }>
      expect(scopedEntries).toHaveLength(1)
      expect(scopedEntries[0].id).toBe('feed-riley')
    })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(0)
  })

  it('creates and archives babies from settings controls', async () => {
    const user = userEvent.setup()
    let babies = [
      { id: 'baby-1', name: 'Avery', dob: '2026-01-01' },
      { id: 'baby-2', name: 'Riley', dob: '2026-02-14' },
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method || 'GET'
      if (url === '/api/auth/me') return new Response(JSON.stringify({ ok: true, user: { id: 'user-1', householdId: 'household-1', babyId: 'baby-1', role: 'caregiver', mode: 'session' } }), { status: 200 })
      if (url === '/api/babies' && method === 'GET') return new Response(JSON.stringify({ ok: true, babies }), { status: 200 })
      if (url === '/api/babies' && method === 'POST') {
        const body = JSON.parse(String(init?.body || '{}')) as { name?: string; dob?: string }
        babies = [...babies, { id: 'baby-3', name: body.name || '', dob: body.dob || '' }]
        return new Response(JSON.stringify({ ok: true, baby: babies[2] }), { status: 201 })
      }
      if (url === '/api/babies/baby-2' && method === 'DELETE') {
        babies = babies.filter((baby) => baby.id !== 'baby-2')
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (url === '/api/notification-settings') return new Response(JSON.stringify({ available: false, gotifyRemindersEnabled: false }), { status: 200 })
      if (url === '/api/state' && !init?.method) return new Response(JSON.stringify({ entries: [], diapers: [], medicines: [], session: null, theme: 'light', updatedAt: 'server-1' }), { status: 200 })
      return new Response(JSON.stringify({ ok: true, updatedAt: 'server-write' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByLabelText(/Active baby/i)
    await user.click(screen.getByRole('button', { name: /Show settings/i }))
    await user.click(await screen.findByRole('tab', { name: /Baby/i }))
    await user.type(await screen.findByLabelText(/New baby name/i), 'Morgan')
    await user.type(screen.getByLabelText(/New baby date of birth/i), '2026-03-15')
    await user.click(screen.getByRole('button', { name: /Add baby/i }))

    await waitFor(() => expect(screen.getByLabelText(/Active baby/i).textContent).toMatch(/Morgan/i))
    expect(fetchMock).toHaveBeenCalledWith('/api/babies', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Morgan', dob: '2026-03-15' }),
    }))

    // Creating a baby switches to it and remounts the tracker (per-baby isolation),
    // which closes the settings panel; reopen it to manage the roster.
    await user.click(screen.getByRole('button', { name: /Show settings/i }))
    await user.click(await screen.findByRole('tab', { name: /Baby/i }))
    await user.click(await screen.findByRole('button', { name: /Archive Riley/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Archive Riley/i })).toBeNull())
    expect(fetchMock).toHaveBeenCalledWith('/api/babies/baby-2', expect.objectContaining({ method: 'DELETE' }))
  })

  it('keeps this device theme preference after server hydration', async () => {
    const user = userEvent.setup()
    document.cookie = 'baby_feeding_theme=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    localStorage.setItem('baby-feeding-tracker:v1:theme', 'light')
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/notification-settings') return new Response(JSON.stringify({ available: false, gotifyRemindersEnabled: false }), { status: 200 })
      if (String(input) === '/api/state' && !init?.method) return new Response(JSON.stringify({ entries: [], diapers: [], medicines: [], session: null, theme: 'dark', updatedAt: 'server-1' }), { status: 200 })
      return new Response(JSON.stringify({ ok: true, updatedAt: 'server-2' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/state', expect.objectContaining({ cache: 'no-store' })))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    await user.click(screen.getByRole('button', { name: /Show settings/i }))
    await user.click(await screen.findByRole('tab', { name: /Appearance/i }))
    expect(await screen.findByRole('switch', { name: /Dark mode/i })).toBeTruthy()
  })
})
