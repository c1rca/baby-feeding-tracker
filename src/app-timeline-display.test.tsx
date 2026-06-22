import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  STORAGE_KEY,
  setupAppTestEnvironment,
} from './appTestSetup'

describe('App interactions', () => {
  setupAppTestEnvironment()

  it('shows older timeline entries with the calendar date before the clock time', () => {
    const now = new Date(2026, 5, 10, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'old-feed', type: 'breast', startedAt: new Date(2026, 5, 4, 5, 0).getTime(), endedAt: new Date(2026, 5, 4, 5, 15).getTime(), leftSeconds: 15 * 60, rightSeconds: 0, bottleOunces: null, note: '' }]),
    )

    render(<App />)

    expect(screen.getByText(/Jun 4.*5:00 AM/i)).toBeTruthy()
    expect(screen.getByText(/6 days ago/i)).toBeTruthy()
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
    expect(within(firstItem).getByText(/Left: 7m 00s/i)).toBeTruthy()
    expect(within(firstItem).getByText(/Right: 5m 00s/i)).toBeTruthy()
    expect(within(firstItem).getByText(/2\.5 oz/i)).toBeTruthy()
    expect(within(firstItem).getByText(/sleepy feed/i)).toBeTruthy()
    expect(within(firstItem).getByText(/ago/i).className).toContain('timeline-age')
    expect(within(firstItem).getByRole('button', { name: /Resume recent entry/i })).toBeTruthy()
    expect(within(firstItem).queryByRole('button', { name: /^Edit entry$/i })).toBeNull()
    expect(within(firstItem).queryByRole('button', { name: /^Delete entry$/i })).toBeNull()

    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))

    expect(within(firstItem).getByRole('menuitem', { name: /Resume session/i })).toBeTruthy()
    expect(within(firstItem).getByRole('menuitem', { name: /Edit entry/i })).toBeTruthy()
    expect(within(firstItem).getByRole('menuitem', { name: /Delete entry/i })).toBeTruthy()
  })

  it('orders backfilled timeline feeds by their feed start time and ages them from that start time', () => {
    vi.setSystemTime(new Date(2026, 5, 5, 12, 0))
    const newerStart = new Date(2026, 5, 5, 10, 0).getTime()
    const olderStart = new Date(2026, 5, 5, 8, 0).getTime()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'older-long-backfill',
          type: 'breast',
          startedAt: olderStart,
          endedAt: olderStart + 3 * 60 * 60 * 1000,
          leftSeconds: 90 * 60,
          rightSeconds: 90 * 60,
          bottleOunces: null,
          note: 'older backfill',
        },
        {
          id: 'newer-short-feed',
          type: 'bottle',
          startedAt: newerStart,
          endedAt: newerStart + 5 * 60 * 1000,
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 2,
          note: 'newer feed',
        },
      ]),
    )

    render(<App />)

    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText(/newer feed/i)).toBeTruthy()
    expect(within(items[0]).getByText(/about 2 hours ago/i)).toBeTruthy()
    expect(within(items[1]).getByText(/older backfill/i)).toBeTruthy()
    expect(within(items[1]).getByText(/about 4 hours ago/i)).toBeTruthy()
  })

  it('pages older timeline events after the last 48 hours and can show all', async () => {
    const now = new Date(2026, 5, 10, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'recent-feed', type: 'breast', startedAt: now - 2 * 60 * 60 * 1000, endedAt: now - 2 * 60 * 60 * 1000 + 10 * 60 * 1000, leftSeconds: 10 * 60, rightSeconds: 0, bottleOunces: null, note: 'recent feed' },
        ...Array.from({ length: 26 }, (_, index) => ({ id: `old-feed-${index}`, type: 'bottle', startedAt: now - (72 + index) * 60 * 60 * 1000, endedAt: now - (72 + index) * 60 * 60 * 1000, leftSeconds: 0, rightSeconds: 0, bottleOunces: 2, note: `old feed ${index}` })),
      ]),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    expect(screen.getByText(/Latest first · past 48 hours/i)).toBeTruthy()
    expect(screen.getByText(/recent feed/i)).toBeTruthy()
    expect(screen.getByText(/old feed 0/i)).toBeTruthy()
    expect(screen.queryByText(/old feed 25/i)).toBeNull()
    expect(screen.getByText(/older page 1 of 2/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Older/i }))
    expect(screen.getByText(/old feed 25/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Show all/i }))
    expect(screen.getByText(/Showing all 27 events/i)).toBeTruthy()
    expect(screen.getByText(/old feed 0/i)).toBeTruthy()
    expect(screen.getByText(/old feed 25/i)).toBeTruthy()
  })

  it('keeps saved timeline metrics compact and non-redundant', () => {
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

    expect(within(rightOnlyItem).getByText(/^R$/i)).toBeTruthy()
    expect(within(rightOnlyItem).queryByText(/2m 00s total/i)).toBeNull()
    expect(within(rightOnlyItem).getByText(/^2m 00s$/i)).toBeTruthy()
    expect(within(rightOnlyItem).queryByText(/Right: 2m 00s/i)).toBeNull()
    expect(within(rightOnlyItem).queryByText(/^Left /i)).toBeNull()
  })
})
