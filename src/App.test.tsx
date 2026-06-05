import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_SESSION_KEY = 'baby-feeding-tracker:v1:session'
import App from './App'

const STORAGE_KEY = 'baby-feeding-tracker:v1:entries'

describe('App interactions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('logs a quick bottle entry and shows toast feedback', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Log bottle-only feed/i }))
    await user.click(screen.getByRole('button', { name: /^log bottle$/i }))

    expect(screen.getByText(/Bottle feed saved/i)).toBeTruthy()
    expect(screen.getByText(/Feeds today/i).nextElementSibling?.textContent).toBe('1')
  })

  it('deletes and restores an entry with undo', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-1',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 3,
          note: 'test',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Delete entry/i }))
    expect(within(firstItem).getByText(/Are you sure/i)).toBeTruthy()
    expect(screen.queryByText(/Entry deleted/i)).toBeNull()
    await user.click(within(firstItem).getByRole('menuitem', { name: /Confirm delete entry/i }))
    expect(screen.getByText(/Entry deleted/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Undo delete/i }))
    expect(screen.getByText(/Deletion undone/i)).toBeTruthy()
    expect(screen.getAllByText(/3\.0 oz/i).length).toBeGreaterThan(0)
  })

  it('resumes a saved timeline entry as an active paused session and offers undo', async () => {
    const endedAt = Date.now()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-resume',
          type: 'mixed',
          startedAt: endedAt - 900000,
          endedAt,
          leftSeconds: 420,
          rightSeconds: 300,
          bottleOunces: 2.5,
          note: 'resume me',
        },
      ]),
    )

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Resume session/i }))

    expect(screen.getByText(/Session resumed/i)).toBeTruthy()
    expect(screen.getByText(/Paused/i)).toBeTruthy()
    const liveSplit = screen.getByLabelText(/Live split/i)
    expect(within(liveSplit).getByText(/^Left$/i).nextElementSibling?.textContent).toMatch(/7m 00s/)
    expect(within(liveSplit).getByText(/^Right$/i).nextElementSibling?.textContent).toMatch(/5m 00s/)
    expect(within(liveSplit).getByText(/^Bottle$/i).nextElementSibling?.textContent).toBe('2.5 oz')
    expect(screen.getByDisplayValue(/resume me/i)).toBeTruthy()
    await waitFor(() => expect(scrollSpy).toHaveBeenCalled())
    expect(document.activeElement?.textContent).toMatch(/Resume Left/i)
    expect(screen.queryByText(/mixed/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Undo resume/i }))

    expect(screen.getByText(/Resume undone/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /End feed/i })).toBeNull()
    expect(screen.getByText(/mixed/i)).toBeTruthy()
  })

  it('does not resume an entry over an active session', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-resume-blocked',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 3,
          note: '',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Resume session/i }))

    expect(screen.getByText(/Finish or clear the active feed before resuming another entry/i)).toBeTruthy()
    expect(screen.getByText(/On left/i)).toBeTruthy()
    expect(within(firstItem).getByText(/bottle/i)).toBeTruthy()
  })

  it('keeps timeline rows scan-first with actions tucked into a compact menu', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-compact-actions',
          type: 'mixed',
          startedAt: Date.now() - 900000,
          endedAt: Date.now(),
          leftSeconds: 420,
          rightSeconds: 300,
          bottleOunces: 2.5,
          note: 'sleepy feed',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    expect(within(firstItem).getByText(/12m 00s total/i)).toBeTruthy()
    expect(within(firstItem).getByText(/L 7m 00s/i)).toBeTruthy()
    expect(within(firstItem).getByText(/R 5m 00s/i)).toBeTruthy()
    expect(within(firstItem).getByText(/2\.5 oz/i)).toBeTruthy()
    expect(within(firstItem).getByText(/sleepy feed/i)).toBeTruthy()
    expect(within(firstItem).getByRole('button', { name: /Resume recent entry/i })).toBeTruthy()
    expect(within(firstItem).queryByRole('button', { name: /^Edit entry$/i })).toBeNull()
    expect(within(firstItem).queryByRole('button', { name: /^Delete entry$/i })).toBeNull()

    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))

    expect(within(firstItem).getByRole('menuitem', { name: /Resume session/i })).toBeTruthy()
    expect(within(firstItem).getByRole('menuitem', { name: /Edit entry/i })).toBeTruthy()
    expect(within(firstItem).getByRole('menuitem', { name: /Delete entry/i })).toBeTruthy()
  })

  it('closes a timeline action menu when clicking outside it', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-menu-outside-click',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 3,
          note: '',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    expect(within(firstItem).getByRole('menuitem', { name: /Edit entry/i })).toBeTruthy()

    await user.click(screen.getByText(/Baby Feeding Tracker/i))

    expect(within(firstItem).queryByRole('menuitem', { name: /Edit entry/i })).toBeNull()
  })

  it('hides zero-valued nursing metrics in saved timeline entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-bottle-only',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 3,
          note: '',
        },
        {
          id: 'entry-right-only',
          type: 'breast',
          startedAt: Date.now() - 600000,
          endedAt: Date.now() - 480000,
          leftSeconds: 0,
          rightSeconds: 120,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    render(<App />)

    const [bottleItem, rightOnlyItem] = screen.getAllByRole('listitem')
    expect(within(bottleItem).getByText(/3\.0 oz/i)).toBeTruthy()
    expect(within(bottleItem).queryByText(/0m 00s/i)).toBeNull()
    expect(within(bottleItem).queryByText(/^L /i)).toBeNull()
    expect(within(bottleItem).queryByText(/^R /i)).toBeNull()

    expect(within(rightOnlyItem).getByText(/2m 00s total/i)).toBeTruthy()
    expect(within(rightOnlyItem).getByText(/R 2m 00s/i)).toBeTruthy()
    expect(within(rightOnlyItem).queryByText(/^L /i)).toBeNull()
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

  it('schedules 2h and 3h feeding notifications with a Feedr link', () => {
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
          startedAt: base - 600000,
          endedAt: base,
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

  it('shows the next feeding window two to three hours after the last feed', () => {
    const endedAt = new Date(2026, 5, 5, 8, 0).getTime()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-window',
          type: 'breast',
          startedAt: endedAt - 600000,
          endedAt,
          leftSeconds: 300,
          rightSeconds: 300,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    render(<App />)

    expect(screen.getByText(/Next feed/i)).toBeTruthy()
    expect(screen.getByText(/10:00.*11:00/i)).toBeTruthy()
  })

  it('puts priority feed cues above the counter with micro timing below', () => {
    const firstEndedAt = new Date(2026, 5, 5, 8, 0).getTime()
    const secondEndedAt = new Date(2026, 5, 5, 10, 30).getTime()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-latest-window',
          type: 'breast',
          startedAt: secondEndedAt - 600000,
          endedAt: secondEndedAt,
          leftSeconds: 300,
          rightSeconds: 300,
          bottleOunces: null,
          note: '',
        },
        {
          id: 'entry-earlier-window',
          type: 'breast',
          startedAt: firstEndedAt - 600000,
          endedAt: firstEndedAt,
          leftSeconds: 300,
          rightSeconds: 300,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    const { container } = render(<App />)
    const heroText = container.querySelector('.hero')?.textContent || ''

    expect(screen.queryByText(/Active Feed/i)).toBeNull()
    expect(screen.getByText(/Avg 2h 30m/i)).toBeTruthy()
    expect(screen.getByText(/Next feed/i)).toBeTruthy()
    expect(screen.getByText(/12:30.*1:30/i)).toBeTruthy()
    expect(screen.getByText(/Last /i)).toBeTruthy()
    expect(heroText.indexOf('Suggested:')).toBeLessThan(heroText.indexOf('0m 00s'))
    expect(heroText.indexOf('0m 00s')).toBeLessThan(heroText.indexOf('Last '))
    expect(heroText.indexOf('Last ')).toBeLessThan(heroText.indexOf('Avg 2h 30m'))
  })

  it('shows inline resume only on the latest two timeline entries', () => {
    const base = Date.now()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        [0, 1, 2].map((index) => ({
          id: `entry-inline-${index}`,
          type: 'breast',
          startedAt: base - index * 600000 - 300000,
          endedAt: base - index * 600000,
          leftSeconds: 300,
          rightSeconds: 0,
          bottleOunces: null,
          note: '',
        })),
      ),
    )

    render(<App />)

    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByRole('button', { name: /Resume recent entry/i })).toBeTruthy()
    expect(within(items[1]).getByRole('button', { name: /Resume recent entry/i })).toBeTruthy()
    expect(within(items[2]).queryByRole('button', { name: /Resume recent entry/i })).toBeNull()
  })

  it('edits ounces in timeline item', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-2',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 2,
          note: '',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Edit/i }))
    const ouncesInput = screen.getByPlaceholderText(/e\.g\. 2\.5/i)
    await user.clear(ouncesInput)
    await user.type(ouncesInput, '4.5')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    expect(screen.getByText(/Entry updated/i)).toBeTruthy()
    expect(screen.getAllByText(/4\.5 oz/i).length).toBeGreaterThan(0)
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

  it('end feed creates entry and persists to localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByRole('button', { name: /End feed/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /End feed/i }))

    expect(screen.getByText(/Feed saved/i)).toBeTruthy()
    const savedEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<{ id: string }>
    expect(savedEntries.length).toBe(1)
    expect(savedEntries[0].id).toBeTruthy()
    expect(localStorage.getItem(STORAGE_SESSION_KEY)).toBe('null')
  })

  it('suggests the opposite side from the last nursing feed and supports one-tap start', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-3',
          type: 'breast',
          startedAt: Date.now() - 120000,
          endedAt: Date.now() - 60000,
          leftSeconds: 0,
          rightSeconds: 120,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText(/Suggested:/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByText(/On left/i)).toBeTruthy()
  })

  it('shows a live left-right split while a feed is active', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(screen.getByText(/Live split/i)).toBeTruthy()
    expect(screen.getByText(/^Left$/i).nextElementSibling?.textContent).toMatch(/0m/)
    expect(screen.getByText(/^Right$/i).nextElementSibling?.textContent).toMatch(/0m/)
  })

  it('starts a session from a typed clock time and shows elapsed minutes', async () => {
    vi.setSystemTime(new Date('2026-06-05T12:45:00'))
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByLabelText(/Session start time/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Adjust start time/i }))
    const startTime = screen.getByLabelText(/Session start time/i) as HTMLInputElement
    expect(startTime.value).toBe('12:45 PM')
    await user.clear(startTime)
    await user.type(startTime, '12:30pm')

    expect(screen.getAllByText(/15 min ago/i).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(screen.getAllByText(/15m 00s/i).length).toBeGreaterThan(0)
    const savedSession = JSON.parse(localStorage.getItem(STORAGE_SESSION_KEY) || 'null') as { startedAt: number; segmentStart: number }
    expect(savedSession.startedAt).toBe(new Date('2026-06-05T12:30:00').getTime())
    expect(savedSession.segmentStart).toBe(new Date('2026-06-05T12:30:00').getTime())
  })

  it('starts a session from the minutes-ago tab', async () => {
    vi.setSystemTime(new Date('2026-06-05T12:45:00'))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Adjust start time/i }))
    await user.click(screen.getByRole('tab', { name: /Minutes ago/i }))
    await user.clear(screen.getByLabelText(/Start minutes ago/i))
    await user.type(screen.getByLabelText(/Start minutes ago/i), '5')
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(screen.getAllByText(/5m 00s/i).length).toBeGreaterThan(0)
    const savedSession = JSON.parse(localStorage.getItem(STORAGE_SESSION_KEY) || 'null') as { startedAt: number }
    expect(savedSession.startedAt).toBe(new Date('2026-06-05T12:40:00').getTime())
  })

  it('clears an active feed without saving an entry', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByText(/On left/i)).toBeTruthy()

    const clearActive = screen.getByRole('button', { name: /Clear active feed/i })
    expect(clearActive.className).toContain('active-clear-link')
    expect(clearActive.className).not.toContain('subtle-danger')

    await user.click(clearActive)

    expect(screen.getByText(/Active feed cleared/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Undo clear active feed/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /End feed/i })).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toHaveLength(0)
    expect(localStorage.getItem(STORAGE_SESSION_KEY)).toBe('null')

    await user.click(screen.getByRole('button', { name: /Undo clear active feed/i }))

    expect(screen.getByText(/Active feed restored/i)).toBeTruthy()
    expect(screen.getByText(/On left/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /End feed/i }).className).toContain('success')
  })

  it('edits left and right nursing minutes in a timeline item', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-nursing-edit',
          type: 'breast',
          startedAt: Date.now() - 720000,
          endedAt: Date.now(),
          leftSeconds: 420,
          rightSeconds: 300,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Edit/i }))
    await user.clear(screen.getByLabelText(/^Left minutes$/i))
    await user.type(screen.getByLabelText(/^Left minutes$/i), '9')
    await user.clear(screen.getByLabelText(/^Right minutes$/i))
    await user.type(screen.getByLabelText(/^Right minutes$/i), '4')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    expect(screen.getByText(/Entry updated/i)).toBeTruthy()
    const updatedItem = screen.getAllByRole('listitem')[0]
    expect(within(updatedItem).getByText(/L\s+9m 00s/i)).toBeTruthy()
    expect(within(updatedItem).getByText(/R\s+4m 00s/i)).toBeTruthy()
    const savedEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<{ leftSeconds: number; rightSeconds: number }>
    expect(savedEntries[0].leftSeconds).toBe(540)
    expect(savedEntries[0].rightSeconds).toBe(240)
  })

  it('requires confirmation before clearing all data', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-4',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 3,
          note: '',
        },
      ]),
    )
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Show settings/i }))
    await user.click(screen.getByRole('button', { name: /Clear all data/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.getAllByText(/3\.0 oz/i).length).toBeGreaterThan(0)
    confirmSpy.mockRestore()
  })

  it('adds a missed manual feed with bottle and nursing details', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Add missed feed/i }))
    await user.clear(screen.getByLabelText(/Manual bottle ounces/i))
    await user.type(screen.getByLabelText(/Manual bottle ounces/i), '2.5')
    await user.clear(screen.getByLabelText(/Manual left minutes/i))
    await user.type(screen.getByLabelText(/Manual left minutes/i), '7')
    await user.clear(screen.getByLabelText(/Manual right minutes/i))
    await user.type(screen.getByLabelText(/Manual right minutes/i), '5')
    await user.type(screen.getByLabelText(/Manual note/i), 'late log')
    await user.click(screen.getByRole('button', { name: /Save missed feed/i }))

    expect(screen.getByText(/Missed feed saved/i)).toBeTruthy()
    expect(screen.getByText(/mixed/i)).toBeTruthy()
    expect(screen.getAllByText(/2\.5 oz/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/late log/i)).toBeTruthy()
  })

  it('uses explicit bottle copy during active nursing sessions', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: /Log bottle-only feed/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByRole('button', { name: /Add bottle to this feed/i })).toBeTruthy()
  })

  it('closes modal workflows with Escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Add missed feed/i }))
    expect(screen.getByRole('dialog', { name: /Add missed feed/i })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Add missed feed/i })).toBeNull()
  })

  it('keeps offline changes locally and syncs them on reconnect', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    expect(await screen.findByText(/Offline changes saved/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Log bottle-only feed/i }))
    await user.click(screen.getByRole('button', { name: /^log bottle$/i }))
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBe('1')

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    window.dispatchEvent(new Event('online'))
    expect(await screen.findByText(/^Synced$/i)).toBeTruthy()
    expect(localStorage.getItem('baby-feeding-tracker:v1:pending-sync')).toBeNull()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/state', expect.objectContaining({ method: 'PUT' }))
  })
})
