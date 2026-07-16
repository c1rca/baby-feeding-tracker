import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Entry } from './types'
import {
  STORAGE_KEY,
  setupAppTestEnvironment,
} from './appTestSetup'

describe('App interactions', () => {
  setupAppTestEnvironment()

  it('keeps bottle and missed feed as separate actions inside additional options', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByRole('button', { name: /Log bottle-only feed/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add missed feed/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: /Additional options/i }))

    const bottleGroup = screen.getByRole('group', { name: /Bottle feed/i })
    const missedGroup = screen.getByRole('group', { name: /Missed feed/i })
    expect(within(bottleGroup).getByRole('button', { name: /Log bottle-only feed/i })).toBeTruthy()
    expect(within(missedGroup).getByRole('button', { name: /Add missed feed/i })).toBeTruthy()
    expect(within(bottleGroup).queryByRole('button', { name: /Add missed feed/i })).toBeNull()
  })

  it('lets a missed feed be saved at a chosen date and time', async () => {
    const now = new Date(2026, 5, 10, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(screen.getByRole('button', { name: /Add missed feed/i }))

    const dialog = screen.getByRole('dialog', { name: /Add missed feed/i })
    expect(within(dialog).getByLabelText(/Feed date/i)).toHaveProperty('value', '2026-06-10')
    expect(within(dialog).getByLabelText(/Feed start time/i)).toHaveProperty('value', '12:00')

    await user.clear(within(dialog).getByLabelText(/Feed date/i))
    await user.type(within(dialog).getByLabelText(/Feed date/i), '2026-06-04')
    await user.clear(within(dialog).getByLabelText(/Feed start time/i))
    await user.type(within(dialog).getByLabelText(/Feed start time/i), '05:00')
    await user.type(within(dialog).getByLabelText(/Manual left minutes/i), '15')
    await user.click(within(dialog).getByRole('button', { name: /Save missed feed/i }))

    expect(screen.getByText(/Missed feed saved/i)).toBeTruthy()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(saved[0].startedAt).toBe(new Date(2026, 5, 4, 5, 0).getTime())
    expect(saved[0].endedAt).toBe(new Date(2026, 5, 4, 5, 15).getTime())
  })

  it('keeps the real latest feed first when saving an older missed feed', async () => {
    const now = new Date(2026, 5, 10, 12, 0).getTime()
    const latestStart = new Date(2026, 5, 10, 9, 30).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'latest-real-feed', type: 'breast', startedAt: latestStart, endedAt: latestStart + 12 * 60 * 1000, leftSeconds: 12 * 60, rightSeconds: 0, bottleOunces: null, note: '' }]),
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(screen.getByRole('button', { name: /Add missed feed/i }))
    const dialog = screen.getByRole('dialog', { name: /Add missed feed/i })
    await user.clear(within(dialog).getByLabelText(/Feed date/i))
    await user.type(within(dialog).getByLabelText(/Feed date/i), '2026-06-10')
    await user.clear(within(dialog).getByLabelText(/Feed start time/i))
    await user.type(within(dialog).getByLabelText(/Feed start time/i), '06:00')
    await user.type(within(dialog).getByLabelText(/Manual left minutes/i), '15')
    await user.click(within(dialog).getByRole('button', { name: /Save missed feed/i }))

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Entry[]
    expect(saved[0].id).toBe('latest-real-feed')
    expect(saved[0].startedAt).toBe(latestStart)
    expect(screen.getByText(/11:30 AM–12:30 PM/i)).toBeTruthy()
    expect(screen.getByText(/Last 2h 18m ago/i)).toBeTruthy()
  })

  it('logs a quick bottle entry and shows toast feedback', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(screen.getByRole('button', { name: /Log bottle-only feed/i }))
    await user.click(screen.getByRole('button', { name: /^log bottle$/i }))

    expect(screen.getByText(/Bottle feed saved/i)).toBeTruthy()
    expect(screen.getByText(/Feeds today/i).nextElementSibling?.textContent).toBe('1')
  })

  it('puts priority feed cues above the counter with micro timing below', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 5, 5, 11, 30))
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
    const briefText = container.querySelector('.today-brief')?.textContent || ''

    expect(screen.queryByText(/Active Feed/i)).toBeNull()
    expect(screen.queryByText(/^Ready$/i)).toBeNull()
    expect(screen.getByText(/Avg 2h 30m/i)).toBeTruthy()
    expect(screen.getByText(/^Next feed$/i)).toBeTruthy()
    expect(briefText).toMatch(/in 50m/i)
    expect(briefText).toMatch(/12:20.*1:20.*PM/i)
    expect(document.querySelector('.next-feed-side')?.textContent?.trim()).toBe('Left')
    expect(screen.getByText(/Last /i)).toBeTruthy()
    expect(briefText).not.toMatch(/Suggested:/i)
    // idle page leads with the caregiver brief: next feed cue, then timing meta, then start actions
    expect(briefText.indexOf('Next feed')).toBeLessThan(briefText.indexOf('Last '))
    expect(briefText.indexOf('Last ')).toBeLessThan(briefText.indexOf('Avg 2h 30m'))
    expect(briefText.indexOf('Avg 2h 30m')).toBeLessThan(briefText.indexOf('Start Left'))
    expect(briefText).not.toMatch(/0m 00s/)
  })
})
