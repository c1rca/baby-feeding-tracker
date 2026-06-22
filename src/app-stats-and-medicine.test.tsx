import { render, screen, within } from '@testing-library/react'
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

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Show stats/i }))

    expect(localStorage.getItem('baby-feeding-tracker-view')).toBe('stats')
    expect(screen.getByRole('region', { name: /Stats dashboard/i })).toBeTruthy()
    expect(screen.getByText(/24h momentum/i)).toBeTruthy()
    expect(screen.getByText(/Longest stretch/i)).toBeTruthy()
    expect(screen.getByText(/Longest nursing/i)).toBeTruthy()
    expect(screen.getByText(/Next side cue/i)).toBeTruthy()
    expect(screen.getByText(/Smart read/i)).toBeTruthy()
    expect(screen.getByText(/Diaper signal/i)).toBeTruthy()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.getByText(/Wet\/day/i)).toBeTruthy()
    expect(screen.getByText(/Stool\/day/i)).toBeTruthy()
    expect(screen.getAllByText(/Today: 2 · All-time: 2.0/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Today: 1 · All-time: 1.0/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/wet/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/stool/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: /Timeline/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: /Show tracker/i }))
    expect(screen.getByRole('heading', { name: /Timeline/i })).toBeTruthy()
    expect(screen.queryByRole('region', { name: /Stats dashboard/i })).toBeNull()
  })

  it('uses a premium growth chart with metric tabs and modal measurement entry', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Show stats/i }))
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

    await user.click(screen.getByRole('button', { name: /Show stats/i }))
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

  it('reopens the stats page from persisted view and keeps header actions ordered', () => {
    localStorage.setItem('baby-feeding-tracker-view', 'stats')

    render(<App />)

    expect(screen.getByRole('region', { name: /Stats dashboard/i })).toBeTruthy()
    const headerButtons = Array.from(document.querySelectorAll('.top-actions button')).map((button) => button.getAttribute('aria-label'))
    expect(headerButtons).toEqual(['Show tracker', 'Show settings', 'Enable dark mode'])
  })

  it('keeps medicine controls collapsed, alternates reminders, and undoes a new medicine log', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_MEDICINES_KEY,
      JSON.stringify([{ id: 'dose-old', kind: 'tylenol', at: now - 6 * 60 * 60 * 1000 - 1 }]),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    expect(screen.getByRole('alert').textContent).toMatch(/Take Tylenol/i)
    expect(screen.getByRole('button', { name: /Log Tylenol now/i })).toBeTruthy()
    expect(screen.getByRole('banner').nextElementSibling).toBe(screen.getByRole('alert'))
    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    const medicineGroup = screen.getByRole('group', { name: /^Medicine$/i })
    expect(within(medicineGroup).getByRole('button', { name: /Log Tylenol/i })).toBeTruthy()
    expect(within(medicineGroup).getByRole('button', { name: /Log Motrin/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Dismiss medicine reminder/i }))
    expect(screen.queryByRole('alert')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Log Tylenol/i }))
    expect(screen.getByText(/Tylenol logged/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Additional options/i }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /Log Tylenol/i })).toBeNull()
    expect(screen.getAllByText(/^Tylenol$/i).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Undo medicine log/i }))
    expect(screen.getByText(/Medicine log undone/i)).toBeTruthy()
    expect(screen.queryAllByText(/^Tylenol$/i).length).toBe(1)
  })

  it('quick logs the due medicine from the reminder banner', async () => {
    const now = new Date('2026-06-05T14:00:00Z').getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'dose-old', kind: 'motrin', at: now - 6 * 60 * 60 * 1000 - 1 }]))

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/Take Motrin/i)
    await user.click(within(alert).getByRole('button', { name: /Log Motrin now/i }))

    expect(screen.getByText(/Motrin logged/i)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
    expect(saved[0].kind).toBe('motrin')
    expect(saved[0].at).toBe(now)
  })

  it('shows a medicine reminder for a due kind even when another medicine was taken more recently', () => {
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

    expect(screen.getByRole('alert').textContent).toMatch(/Take Motrin/i)
    expect(screen.getByRole('alert').textContent).toMatch(/Last dose was Motrin/i)
  })
})
