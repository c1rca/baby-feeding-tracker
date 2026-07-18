import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  STORAGE_DIAPERS_KEY,
  STORAGE_KEY,
  STORAGE_MEDICINES_KEY,
  setupAppTestEnvironment,
} from './appTestSetup'

describe('App interactions', () => {
  setupAppTestEnvironment()

  it('opens a polished stats dashboard with deeper care insights', async () => {
    const now = Date.now()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'latest-r', type: 'breast', startedAt: now - 2 * 60 * 60 * 1000, endedAt: now - 2 * 60 * 60 * 1000 + 15 * 60 * 1000, leftSeconds: 0, rightSeconds: 15 * 60, bottleOunces: null, note: '' },
        { id: 'left-long', type: 'breast', startedAt: now - 6 * 60 * 60 * 1000, endedAt: now - 6 * 60 * 60 * 1000 + 30 * 60 * 1000, leftSeconds: 30 * 60, rightSeconds: 0, bottleOunces: null, note: '', diaperKinds: ['wet'] },
        { id: 'mixed', type: 'mixed', startedAt: now - 26 * 60 * 60 * 1000, endedAt: now - 26 * 60 * 60 * 1000 + 20 * 60 * 1000, leftSeconds: 8 * 60, rightSeconds: 7 * 60, bottleOunces: 2.5, note: '' },
      ]),
    )
    localStorage.setItem(STORAGE_DIAPERS_KEY, JSON.stringify([{ id: 'diaper-1', kinds: ['wet', 'stool'], at: now - 60 * 60 * 1000, context: 'standalone' }]))
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'vitamin-today', kind: 'vitamin_d', at: now - 3 * 60 * 60 * 1000 }]))
    localStorage.setItem('baby-feeding-tracker:v1:tummy-times', JSON.stringify([
      { id: 'tummy-today', startedAt: now - 90 * 60 * 1000, endedAt: now - 78 * 60 * 1000, note: '' },
      { id: 'tummy-yesterday', startedAt: now - 24 * 60 * 60 * 1000, endedAt: now - 24 * 60 * 60 * 1000 + 20 * 60 * 1000, note: '' },
    ]))

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Insights$/i }))

    expect(localStorage.getItem('baby-feeding-tracker-view')).toBe('stats')
    expect(screen.getByRole('region', { name: /Stats dashboard/i })).toBeTruthy()
    const jumpMenu = screen.getByRole('navigation', { name: /Jump to care insights/i })
    expect(within(jumpMenu).getByRole('link', { name: /Feeding/i }).getAttribute('href')).toBe('#feeding-stats')
    expect(within(jumpMenu).getByRole('link', { name: /Diapers/i }).getAttribute('href')).toBe('#diaper-stats')
    expect(within(jumpMenu).getByRole('link', { name: /Tummy time/i }).getAttribute('href')).toBe('#tummy-stats')
    expect(within(jumpMenu).getByRole('link', { name: /Growth/i }).getAttribute('href')).toBe('#growth-stats')
    expect(document.getElementById('feeding-stats')).toBeTruthy()
    expect(document.getElementById('diaper-stats')).toBeTruthy()
    expect(document.getElementById('tummy-stats')).toBeTruthy()
    expect(document.getElementById('growth-stats')).toBeTruthy()
    expect(screen.getByText(/24h momentum/i)).toBeTruthy()
    expect(screen.getByText(/Longest stretch/i)).toBeTruthy()
    expect(screen.getByText(/Longest nursing/i)).toBeTruthy()
    expect(screen.getByText(/Next side cue/i)).toBeTruthy()
    expect(screen.queryByText(/Smart read/i)).toBeNull()
    expect(screen.getByText(/Diaper signal/i)).toBeTruthy()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.getByText(/Wet\/day/i)).toBeTruthy()
    expect(screen.getByText(/Stool\/day/i)).toBeTruthy()
    expect(screen.getAllByText(/Today: 2 · All-time: 2.0/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Today: 1 · All-time: 1.0/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Vitamin D/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Taken today/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/1 dose this week/i)).toBeTruthy()
    expect(screen.getByRole('region', { name: /Tummy Time stats/i })).toBeTruthy()
    expect(screen.getAllByText(/12\/20 min today/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/32 minutes captured this week · 1 goal day/i)).toBeTruthy()
    expect(screen.getByText(/Daily avg/i)).toBeTruthy()
    expect(screen.getByText(/Best day/i)).toBeTruthy()
    expect(screen.getByText(/60%/i)).toBeTruthy()
    expect(screen.getAllByText(/wet/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/stool/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: /Timeline/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Track$/i }))
    expect(screen.getByRole('heading', { name: /Timeline/i })).toBeTruthy()
    expect(screen.queryByRole('region', { name: /Stats dashboard/i })).toBeNull()
  })

  it('uses a premium growth chart with metric tabs and modal measurement entry', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Insights$/i }))
    expect(screen.getByRole('region', { name: /Growth percentile tracker/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Weight/i }).getAttribute('aria-selected')).toBe('true')

    await user.click(screen.getByRole('tab', { name: /Length/i }))
    expect(screen.getByRole('tab', { name: /Length/i }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('img', { name: /Length percentile chart/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Add measurement/i }))
    const modal = screen.getByRole('form', { name: /Add growth measurement/i })
    expect(within(modal).getByLabelText(/Calculated age in months/i)).toBeTruthy()
    await user.type(within(modal).getByLabelText(/Pounds/i), '8')
    await user.type(within(modal).getByLabelText(/Ounces/i), '11')
    await user.type(within(modal).getByLabelText(/Length/i), '58')
    await user.type(within(modal).getByLabelText(/Head/i), '39')
    await user.click(within(modal).getByRole('button', { name: /Save measurement/i }))

    expect(screen.queryByRole('form', { name: /Add growth measurement/i })).toBeNull()
    expect(screen.getAllByText(/8 lb 11 oz/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/percentile/i).length).toBeGreaterThan(0)
  })

  it('edits and deletes growth measurements with undo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Insights$/i }))
    await user.click(screen.getByRole('button', { name: /Add measurement/i }))
    let modal = screen.getByRole('form', { name: /Add growth measurement/i })
    await user.type(within(modal).getByLabelText(/Pounds/i), '12')
    await user.type(within(modal).getByLabelText(/Length/i), '58')
    await user.type(within(modal).getByLabelText(/Head/i), '39')
    await user.click(within(modal).getByRole('button', { name: /Save measurement/i }))
    expect(screen.getAllByText(/12 lb/i).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Edit growth measurement/i }))
    modal = screen.getByRole('form', { name: /Edit growth measurement/i })
    await user.clear(within(modal).getByLabelText(/Pounds/i))
    await user.type(within(modal).getByLabelText(/Pounds/i), '13')
    await user.clear(within(modal).getByLabelText(/Ounces/i))
    await user.type(within(modal).getByLabelText(/Ounces/i), '8')
    await user.click(within(modal).getByRole('button', { name: /Save changes/i }))
    expect(screen.getByText(/Growth measurement updated/i)).toBeTruthy()
    expect(screen.getAllByText(/13 lb 8 oz/i).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Undo growth edit/i }))
    expect(screen.getByText(/Growth edit undone/i)).toBeTruthy()
    expect(screen.getAllByText(/12 lb/i).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Delete growth measurement/i }))
    expect(screen.getByText(/Growth measurement deleted/i)).toBeTruthy()
    expect(screen.queryByText(/12 lb/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Undo growth delete/i }))
    expect(screen.getByText(/Growth delete undone/i)).toBeTruthy()
    expect(screen.getAllByText(/12 lb/i).length).toBeGreaterThan(0)
  })

  it('reopens the stats page from persisted view and keeps the workspace controls', () => {
    localStorage.setItem('baby-feeding-tracker-view', 'stats')

    render(<App />)

    expect(screen.getByRole('region', { name: /Stats dashboard/i })).toBeTruthy()
    // The workspace top bar keeps Track/Insights navigation plus settings access,
    // with Insights marked current while the stats view is open.
    const nav = screen.getByRole('navigation', { name: /^Workspace$/i })
    expect(within(nav).getByRole('button', { name: /^Track$/i })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: /^Insights$/i }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: /Open settings/i })).toBeTruthy()
  })

  it('surfaces a due medicine in care needs and undoes a new medicine log', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_MEDICINES_KEY,
      JSON.stringify([{ id: 'dose-old', kind: 'tylenol', at: now - 6 * 60 * 60 * 1000 - 1 }]),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await vi.advanceTimersByTimeAsync(0)

    // A due dose surfaces as an actionable care need, not a blocking banner.
    expect(await screen.findByText(/Tylenol due/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Log Tylenol dose/i }))

    expect(screen.getByText(/Tylenol logged/i)).toBeTruthy()
    // A fresh dose clears the due need.
    expect(screen.queryByText(/Tylenol due/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Undo medicine log/i }))
    expect(screen.getByText(/Medicine log undone/i)).toBeTruthy()
    expect(await screen.findByText(/Tylenol due/i)).toBeTruthy()
  })


  it('surfaces every due medicine and Vitamin D need so none are hidden', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_MEDICINES_KEY,
      JSON.stringify([
        { id: 'vitamin-old', kind: 'vitamin_d', at: now - 19 * 60 * 60 * 1000 },
        { id: 'tylenol-old', kind: 'tylenol', at: now - 6 * 60 * 60 * 1000 - 1 },
        { id: 'motrin-old', kind: 'motrin', at: now - 7 * 60 * 60 * 1000 },
      ]),
    )

    render(<App />)
    await vi.advanceTimersByTimeAsync(0)

    // Every outstanding need shows in care needs at once — none are collapsed away.
    expect(await screen.findByText(/Tylenol due/i)).toBeTruthy()
    expect(screen.getByText(/Motrin due/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Log Tylenol dose/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Log Motrin dose/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Log Vitamin D dose/i })).toBeTruthy()
  })

  it('suppresses the Tylenol banner when Tylenol reminders are turned off', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_MEDICINES_KEY,
      JSON.stringify([
        { id: 'tylenol-old', kind: 'tylenol', at: now - 7 * 60 * 60 * 1000 },
        { id: 'motrin-recent', kind: 'motrin', at: now - 60 * 60 * 1000 },
      ]),
    )
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/notification-settings') {
        return new Response(JSON.stringify({ available: true, gotifyRemindersEnabled: true, medicineReminderSettings: { tylenol: 0, motrin: 6 } }), { status: 200 })
      }
      if (url === '/api/state') {
        return new Response(JSON.stringify({ entries: [], diapers: [], medicines: JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]'), session: null, theme: 'light' }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await vi.advanceTimersByTimeAsync(0)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/notification-settings'))

    // Tylenol interval 0 turns its reminders off, so no Tylenol need surfaces —
    // and Motrin (given an hour ago) isn't due either.
    await waitFor(() => expect(screen.queryByText(/Tylenol due/i)).toBeNull())
    expect(screen.queryByText(/Motrin due/i)).toBeNull()
  })

  it('logs Vitamin D from care needs after 18 hours', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'vitamin-yesterday', kind: 'vitamin_d', at: now - 19 * 60 * 60 * 1000 }]))

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    // Not given today (last dose 19h ago), so Vitamin D shows a log action.
    const logVitaminD = screen.getByRole('button', { name: /Log Vitamin D dose/i })
    await user.click(logVitaminD)

    expect(screen.getByText(/Vitamin D logged/i)).toBeTruthy()
    // Taken today now, so the log action is gone.
    expect(screen.queryByRole('button', { name: /Log Vitamin D dose/i })).toBeNull()
    const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]') as Array<{ kind: string; at: number }>
    expect(saved.some((dose) => dose.kind === 'vitamin_d' && dose.at >= now)).toBe(true)
  })

  it('does not show the Vitamin D banner when Vitamin D was already taken today', () => {
    const now = new Date('2026-06-05T23:00:00').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'vitamin-today', kind: 'vitamin_d', at: new Date('2026-06-05T00:30:00').getTime() }]))

    render(<App />)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps a dismissed medicine reminder hidden after a page refresh', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'dose-old', kind: 'tylenol', at: now - 6 * 60 * 60 * 1000 - 1 }]))

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { unmount } = render(<App />)
    await vi.advanceTimersByTimeAsync(0)

    expect(await screen.findByText(/Tylenol due/i)).toBeTruthy()
    // Dismiss the reminder from the care notification center; it clears the need.
    await user.click(screen.getByRole('button', { name: /Open care notifications/i }))
    await user.click(screen.getByRole('button', { name: /Dismiss Tylenol reminder/i }))
    await waitFor(() => expect(screen.queryByText(/Tylenol due/i)).toBeNull())

    unmount()
    render(<App />)

    // The dismissal persists across a reload.
    expect(screen.queryByText(/Tylenol due/i)).toBeNull()
  })

  it('quick logs the due medicine from care needs', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'dose-old', kind: 'motrin', at: now - 6 * 60 * 60 * 1000 - 1 }]))

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await vi.advanceTimersByTimeAsync(0)

    expect(await screen.findByText(/Motrin due/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Log Motrin dose/i }))

    expect(screen.getByText(/Motrin logged/i)).toBeTruthy()
    expect(screen.queryByText(/Motrin due/i)).toBeNull()
    const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]') as Array<{ kind: string; at: number }>
    const logged = saved.find((dose) => dose.at >= now)
    expect(logged?.kind).toBe('motrin')
    expect(logged?.at).toBeLessThan(now + 1000)
  })

  it('shows a medicine reminder for a due kind even when another medicine was taken more recently', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_MEDICINES_KEY,
      JSON.stringify([
        { id: 'tylenol-recent', kind: 'tylenol', at: now - 4 * 60 * 60 * 1000 },
        { id: 'motrin-due', kind: 'motrin', at: now - 6 * 60 * 60 * 1000 - 1 },
      ]),
    )

    render(<App />)
    await vi.advanceTimersByTimeAsync(0)

    // on the idle page the due kind surfaces as an actionable need in the brief
    expect(await screen.findByText(/Motrin due/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Log Motrin dose/i })).toBeTruthy()
    expect(screen.queryByText(/Tylenol due/i)).toBeNull()
  })
})
