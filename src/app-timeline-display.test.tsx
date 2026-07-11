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

  it('shows an older entry with a calendar date after loading its day', async () => {
    const now = new Date(2026, 5, 10, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'old-feed', type: 'breast', startedAt: new Date(2026, 5, 4, 5, 0).getTime(), endedAt: new Date(2026, 5, 4, 5, 15).getTime(), leftSeconds: 15 * 60, rightSeconds: 0, bottleOunces: null, note: '' }]),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)
    for (let day = 0; day < 6; day += 1) await user.click(screen.getByRole('button', { name: /Load older events/i }))

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

  it('shows only the last 24 hours first and loads one older day at a time', async () => {
    const now = new Date(2026, 5, 10, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'recent-feed', type: 'breast', startedAt: now - 2 * 60 * 60 * 1000, endedAt: now - 2 * 60 * 60 * 1000 + 10 * 60 * 1000, leftSeconds: 10 * 60, rightSeconds: 0, bottleOunces: null, note: 'recent feed' },
        { id: 'day-one-feed', type: 'bottle', startedAt: now - 25 * 60 * 60 * 1000, endedAt: now - 25 * 60 * 60 * 1000, leftSeconds: 0, rightSeconds: 0, bottleOunces: 2, note: 'day one feed' },
        { id: 'day-two-feed', type: 'bottle', startedAt: now - 49 * 60 * 60 * 1000, endedAt: now - 49 * 60 * 60 * 1000, leftSeconds: 0, rightSeconds: 0, bottleOunces: 2, note: 'day two feed' },
      ]),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    expect(screen.getByText(/recent feed/i)).toBeTruthy()
    expect(screen.queryByText(/day one feed/i)).toBeNull()
    expect(screen.queryByText(/day two feed/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Load older events/i }))
    expect(screen.getByText(/day one feed/i)).toBeTruthy()
    expect(screen.queryByText(/day two feed/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Load older events/i }))
    expect(screen.getByText(/day two feed/i)).toBeTruthy()
  })

  it('offers premium timeline filter chips and a simple load-older affordance', () => {
    const now = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'preview-feed', type: 'bottle', startedAt: now, endedAt: now, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: 'preview feed' },
      ...Array.from({ length: 41 }, (_, index) => ({ id: `preview-old-${index}`, type: 'bottle', startedAt: now - (index + 25) * 60 * 60 * 1000, endedAt: now - (index + 25) * 60 * 60 * 1000, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: '' })),
    ]))

    render(<App />)

    const filterGroup = screen.getByRole('group', { name: /Timeline filters/i })
    const allLens = within(filterGroup).getByRole('button', { name: /All events/i })
    expect(allLens.getAttribute('data-filter')).toBe('all')
    expect(within(allLens).queryByText('✦')).toBeNull()
    expect(within(filterGroup).getByRole('button', { name: /Feeds/i })).toBeTruthy()
    expect(within(filterGroup).getByRole('button', { name: /Diapers/i })).toBeTruthy()
    expect(within(filterGroup).getByRole('button', { name: /Sleep/i })).toBeTruthy()
    expect(within(filterGroup).getByRole('button', { name: /Medicines/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Load older events/i })).toBeTruthy()
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
