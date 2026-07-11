import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'
import { shouldShowTummyTimeReminder } from './domain/tummyTime'
import type { TummyTimeEvent } from './types'

const TUMMY_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-times'
const TUMMY_SESSION_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-session'
const TUMMY_GOAL_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-goal-minutes'

describe('Tummy Time tracking', () => {
  setupAppTestEnvironment()

  it('offers quick add buttons and a separate timer start in additional options', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    const group = screen.getByRole('group', { name: /Tummy Time/i })
    expect(within(group).getByRole('button', { name: /Add 5 min Tummy Time/i })).toBeTruthy()
    expect(within(group).getByRole('button', { name: /Add 10 min Tummy Time/i })).toBeTruthy()
    expect(within(group).getByRole('button', { name: /Add 15 min Tummy Time/i })).toBeTruthy()
    expect(within(group).getByRole('button', { name: /Add 20 min Tummy Time/i })).toBeTruthy()
    expect(within(group).getByRole('button', { name: /^Start Tummy Time$/i })).toBeTruthy()

    await user.click(within(group).getByRole('button', { name: /Add 10 min Tummy Time/i }))
    const saved = JSON.parse(localStorage.getItem(TUMMY_STORAGE_KEY) ?? '[]') as TummyTimeEvent[]
    expect(saved).toHaveLength(1)
    expect(saved[0].endedAt - saved[0].startedAt).toBe(10 * 60_000)
    expect(screen.getByText(/10 min Tummy Time saved/i)).toBeTruthy()
    expect(screen.getAllByText(/Tummy Time/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/10m 00s/i)).toBeTruthy()
  })

  it('starts Tummy Time as the active top timer and hides feed start buttons', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(screen.getByRole('button', { name: /^Start Tummy Time$/i }))
    expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_STORAGE_KEY) ?? 'null')).toMatchObject({ note: '' })
    expect(screen.getAllByText(/^Tummy Time$/i).length).toBeGreaterThan(1)
    expect(screen.getAllByText('0m 00s').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /^Stop Tummy Time$/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Start suggested side/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Adjust start time/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Start (Left|Right)$/i })).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Stop Tummy Time$/i }))

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(TUMMY_STORAGE_KEY) ?? '[]') as TummyTimeEvent[]
      expect(saved).toHaveLength(1)
      expect(saved[0].endedAt).toBeGreaterThanOrEqual(saved[0].startedAt)
    })
    expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_STORAGE_KEY) ?? 'null')).toBeNull()
  })

  it('starts Tummy Time directly from the reminder banner and hides the banner', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 5, 10, 9, 0))
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByLabelText(/Tummy Time reminder/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Start Tummy Time from reminder/i }))

    expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_STORAGE_KEY) ?? 'null')).toMatchObject({ note: '' })
    expect(screen.queryByLabelText(/Tummy Time reminder/i)).toBeNull()
    expect(screen.getByRole('button', { name: /^Stop Tummy Time$/i })).toBeTruthy()
  })

  it('keeps Tummy Time start unavailable while a feed session is active', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side/i }))
    await user.click(screen.getByRole('button', { name: /Additional options/i }))

    const group = screen.getByRole('group', { name: /Tummy Time/i })
    expect(within(group).queryByRole('button', { name: /^Start Tummy Time$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /End feed/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Stop Tummy Time$/i })).toBeNull()
    expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_STORAGE_KEY) ?? 'null')).toBeNull()
  })

  it('falls back when crypto.randomUUID is unavailable so buttons still work on plain HTTP clients', async () => {
    const user = userEvent.setup()
    const originalRandomUUID = globalThis.crypto.randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined })
    try {
      render(<App />)
      await user.click(screen.getByRole('button', { name: /Additional options/i }))
      await user.click(screen.getByRole('button', { name: /Add 5 min Tummy Time/i }))
      await waitFor(() => expect(JSON.parse(localStorage.getItem(TUMMY_STORAGE_KEY) ?? '[]')).toHaveLength(1))
      await user.click(screen.getByRole('button', { name: /Additional options/i }))
      await user.click(screen.getByRole('button', { name: /^Start Tummy Time$/i }))
      expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_STORAGE_KEY) ?? 'null')).toMatchObject({ note: '' })
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: originalRandomUUID })
      vi.restoreAllMocks()
    }
  })

  it('lets settings change the Tummy Time daily goal and shows today progress above diapers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 5, 10, 12, 0))
    localStorage.setItem(TUMMY_STORAGE_KEY, JSON.stringify([
      { id: 'tummy-1', startedAt: new Date(2026, 5, 10, 9, 0).getTime(), endedAt: new Date(2026, 5, 10, 9, 12).getTime() },
    ] satisfies TummyTimeEvent[]))
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: /Tummy Time today/i })).toBeTruthy()
    expect(screen.getByText(/12\/20 min/i)).toBeTruthy()
    expect(screen.getByText(/60% of goal/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Show settings/i }))
    await user.click(screen.getByRole('tab', { name: /Baby/i }))
    const goalInput = screen.getByLabelText(/Tummy Time daily goal/i)
    await user.clear(goalInput)
    await user.type(goalInput, '45')

    expect(localStorage.getItem(TUMMY_GOAL_STORAGE_KEY)).toBe('45')
    expect(screen.getByText(/12\/45 min/i)).toBeTruthy()
    expect(screen.getByText(/27% of goal/i)).toBeTruthy()
  })

  it('tracks Sleep as a separate active timer from More actions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    const group = screen.getByRole('group', { name: /Sleep/i })
    await user.click(within(group).getByRole('button', { name: /^Start Sleep$/i }))

    expect(document.querySelector('.timer-mode-pill')?.textContent).toBe('Sleep')
    expect(within(group).queryByRole('button', { name: /^Start Sleep$/i })).toBeNull()
    expect(within(group).getByRole('button', { name: /^Stop Sleep$/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Start Tummy Time$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Adjust start time/i })).toBeNull()

    await user.click(within(group).getByRole('button', { name: /^Stop Sleep$/i }))
    expect(screen.getByText(/Sleep saved/i)).toBeTruthy()
  })

  it('reminds against a configurable daily goal with spacing after partial sessions', () => {
    const at = (hour: number, minutes = 10): TummyTimeEvent => ({ id: `tummy-${hour}`, startedAt: new Date(2026, 5, 10, hour).getTime(), endedAt: new Date(2026, 5, 10, hour, minutes).getTime() })
    expect(shouldShowTummyTimeReminder([], null, new Date(2026, 5, 10, 7).getTime(), 30)).toBe(false)
    expect(shouldShowTummyTimeReminder([], null, new Date(2026, 5, 10, 9).getTime(), 30)).toBe(true)
    expect(shouldShowTummyTimeReminder([at(8, 8)], null, new Date(2026, 5, 10, 10).getTime(), 30)).toBe(false)
    expect(shouldShowTummyTimeReminder([at(8, 8)], null, new Date(2026, 5, 10, 13).getTime(), 30)).toBe(true)
    expect(shouldShowTummyTimeReminder([at(16, 8)], null, new Date(2026, 5, 10, 18).getTime(), 30)).toBe(true)
    expect(shouldShowTummyTimeReminder([at(8), at(14), at(15)], null, new Date(2026, 5, 10, 18).getTime(), 30)).toBe(false)
  })
})
