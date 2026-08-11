import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_KEY, setupAppTestEnvironment } from './appTestSetup'

describe('reaching back through history', () => {
  setupAppTestEnvironment()

  it('jumps straight to an old day without walking the load-more chain', async () => {
    const now = new Date(2026, 5, 30, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'recent-feed', type: 'breast', startedAt: new Date(2026, 5, 30, 8, 0).getTime(), endedAt: new Date(2026, 5, 30, 8, 20).getTime(), leftSeconds: 1200, rightSeconds: 0, bottleOunces: null, note: '' },
        { id: 'ancient-feed', type: 'breast', startedAt: new Date(2026, 5, 2, 5, 0).getTime(), endedAt: new Date(2026, 5, 2, 5, 15).getTime(), leftSeconds: 900, rightSeconds: 0, bottleOunces: null, note: 'the old one' },
      ]),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    // 28 days back — well outside the rolling window the timeline starts with.
    expect(screen.queryByText(/the old one/i)).toBeNull()

    // Search and jump-to-date live behind the magnifier now.
    await user.click(screen.getByRole('button', { name: /Search and jump to a date/i }))
    const picker = screen.getByLabelText(/Jump to date/i)
    await user.clear(picker)
    await user.type(picker, '2026-06-02')

    expect(screen.getByText(/the old one/i)).toBeTruthy()
    // The chosen day replaces the rolling window rather than adding to it.
    expect(screen.queryByText(/Load older events/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Clear date filter/i }))
    expect(screen.queryByText(/the old one/i)).toBeNull()
  })

  it('reports an empty day rather than an empty timeline', async () => {
    const now = new Date(2026, 5, 30, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'only-feed', type: 'breast', startedAt: new Date(2026, 5, 30, 8, 0).getTime(), endedAt: new Date(2026, 5, 30, 8, 20).getTime(), leftSeconds: 1200, rightSeconds: 0, bottleOunces: null, note: '' },
      ]),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    // Search and jump-to-date live behind the magnifier now.
    await user.click(screen.getByRole('button', { name: /Search and jump to a date/i }))
    const picker = screen.getByLabelText(/Jump to date/i)
    await user.clear(picker)
    await user.type(picker, '2026-06-14')

    expect(screen.getByText(/No events logged on this day/i)).toBeTruthy()
  })

  it('recomputes the stats dashboard over the selected range', async () => {
    const now = new Date(2026, 5, 30, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    const dayMs = 24 * 60 * 60 * 1000
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from({ length: 20 }, (_, index) => {
        const endedAt = now - index * dayMs
        return { id: `feed-${index}`, type: 'breast', startedAt: endedAt - 600_000, endedAt, leftSeconds: 600, rightSeconds: 0, bottleOunces: null, note: '' }
      })),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Insights$/i }))

    const rangePicker = await screen.findByRole('group', { name: /Stats date range/i })
    expect(screen.getByText(/7 feeds in 7 days/i)).toBeTruthy()

    await user.click(within(rangePicker).getByRole('button', { name: '30 days' }))
    expect(screen.getByText(/20 feeds in 30 days/i)).toBeTruthy()
  })
})
