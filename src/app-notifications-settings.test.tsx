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

  it('quick logs medicine from a notification link query and removes the query', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    window.history.replaceState({}, '', '/?quickMed=tylenol')

    render(<App />)

    await waitFor(() => expect(screen.getByText(/Tylenol logged/i)).toBeTruthy())
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
      expect(saved).toHaveLength(1)
      expect(saved[0].kind).toBe('tylenol')
    })
    expect(window.location.search).toBe('')
  })

  it('requests notification permission from settings', async () => {
    const requestPermission = vi.fn(async () => 'granted' as NotificationPermission)
    const NotificationMock = vi.fn()
    Object.defineProperty(NotificationMock, 'permission', { value: 'default', configurable: true })
    Object.defineProperty(NotificationMock, 'requestPermission', { value: requestPermission, configurable: true })
    vi.stubGlobal('Notification', NotificationMock)

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Show settings/i }))
    await user.click(screen.getByRole('button', { name: /Enable reminders/i }))

    await waitFor(() => expect(requestPermission).toHaveBeenCalled())
    await waitFor(() => expect(localStorage.getItem('baby-feeding-tracker:v1:feeding-notifications')).toBe('1'))
    expect(screen.getByText(/Feeding reminders enabled/i)).toBeTruthy()
  })

  it('schedules 2h and 3h feeding notifications from the feed start with a Feedr link', () => {
    const base = Date.now()
    const scheduled: Array<{ callback: () => void; delay?: number }> = []
    vi.spyOn(window, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number) => {
      if (delay && delay >= 60 * 60 * 1000) scheduled.push({ callback: callback as () => void, delay })
      return 1
    }) as typeof window.setTimeout)
    const notifications: Array<{ title: string; options?: NotificationOptions; close: () => void; onclick?: () => void }> = []
    const NotificationMock = vi.fn(function (this: { title: string; options?: NotificationOptions; close: () => void; onclick?: () => void }, title: string, options?: NotificationOptions) {
      this.title = title
      this.options = options
      this.close = vi.fn()
      notifications.push(this)
    })
    Object.defineProperty(NotificationMock, 'permission', { value: 'granted', configurable: true })
    Object.defineProperty(NotificationMock, 'requestPermission', { value: vi.fn(), configurable: true })
    vi.stubGlobal('Notification', NotificationMock)
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    localStorage.setItem('baby-feeding-tracker:v1:feeding-notifications', '1')
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-reminder',
          type: 'breast',
          startedAt: base,
          endedAt: base + 60 * 60 * 1000,
          leftSeconds: 300,
          rightSeconds: 300,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    render(<App />)

    expect(scheduled.map((timer) => Math.round((timer.delay ?? 0) / (60 * 60 * 1000)))).toEqual([2, 3])
    scheduled[0].callback()
    expect(NotificationMock).toHaveBeenCalledWith('Feeding window reminder', expect.objectContaining({ tag: 'next-feeding-entry-reminder-2h' }))

    scheduled[1].callback()
    expect(NotificationMock).toHaveBeenCalledWith('Feeding window reminder', expect.objectContaining({ tag: 'next-feeding-entry-reminder-3h', requireInteraction: true }))
    notifications[0].onclick?.()
    expect(openSpy).toHaveBeenCalledWith('https://feedr.kjw.lol', '_blank', 'noopener,noreferrer')
  })

  it('toggles Gotify reminders from settings', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/notification-settings' && !init) {
        return new Response(JSON.stringify({ available: true, gotifyRemindersEnabled: false }), { status: 200 })
      }
      if (url === '/api/notification-settings' && init?.method === 'PUT') {
        return new Response(JSON.stringify({ available: true, gotifyRemindersEnabled: true }), { status: 200 })
      }
      if (url === '/api/state') {
        return new Response(JSON.stringify({ entries: [], session: null, theme: 'light' }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Show settings/i }))

    await waitFor(() => expect(screen.getByText(/Gotify reminders/i)).toBeTruthy())
    expect(screen.getByText(/Status: off/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Turn on/i }))

    await waitFor(() => expect(screen.getByText(/Gotify reminders enabled/i)).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith('/api/notification-settings', expect.objectContaining({ method: 'PUT' }))
  })

  it('updates per-medicine server reminder intervals from settings', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/notification-settings' && !init) {
        return new Response(JSON.stringify({ available: true, gotifyRemindersEnabled: true, medicineReminderSettings: { tylenol: 6, motrin: 6 } }), { status: 200 })
      }
      if (url === '/api/notification-settings' && init?.method === 'PUT') {
        return new Response(JSON.stringify({ available: true, gotifyRemindersEnabled: true, medicineReminderSettings: { tylenol: 4, motrin: 0 } }), { status: 200 })
      }
      if (url === '/api/state') {
        return new Response(JSON.stringify({ entries: [], session: null, theme: 'light' }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Show settings/i }))

    const tylenolSelect = await screen.findByLabelText(/Tylenol reminder interval/i)
    const motrinSelect = screen.getByLabelText(/Motrin reminder interval/i)
    expect((tylenolSelect as HTMLSelectElement).value).toBe('6')
    expect((motrinSelect as HTMLSelectElement).value).toBe('6')

    await user.selectOptions(tylenolSelect, '4')
    await user.selectOptions(motrinSelect, '0')

    await waitFor(() => expect(screen.getByText(/Medicine reminder settings saved/i)).toBeTruthy())
    expect(fetchMock).toHaveBeenLastCalledWith('/api/notification-settings', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ medicineReminderSettings: { tylenol: 4, motrin: 0 } }),
    }))
  })
})
