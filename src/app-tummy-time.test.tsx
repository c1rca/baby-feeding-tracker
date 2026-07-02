import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'
import { shouldShowTummyTimeReminder } from './domain/tummyTime'
import type { TummyTimeEvent } from './types'

const TUMMY_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-times'
const TUMMY_SESSION_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-session'

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

  it('starts and stops a Tummy Time timer without changing the nursing side buttons', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(screen.getByRole('button', { name: /^Start Tummy Time$/i }))
    expect(JSON.parse(localStorage.getItem(TUMMY_SESSION_STORAGE_KEY) ?? 'null')).toMatchObject({ note: '' })
    expect(screen.getByRole('button', { name: /^Stop Tummy Time$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Start suggested side/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^Stop Tummy Time$/i }))

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(TUMMY_STORAGE_KEY) ?? '[]') as TummyTimeEvent[]
      expect(saved).toHaveLength(1)
      expect(saved[0].endedAt).toBeGreaterThanOrEqual(saved[0].startedAt)
    })
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

  it('reminds only when behind the four-per-day cadence', () => {
    const at = (hour: number): TummyTimeEvent => ({ id: `tummy-${hour}`, startedAt: new Date(2026, 5, 10, hour).getTime(), endedAt: new Date(2026, 5, 10, hour, 10).getTime() })
    expect(shouldShowTummyTimeReminder([], null, new Date(2026, 5, 10, 7).getTime())).toBe(false)
    expect(shouldShowTummyTimeReminder([], null, new Date(2026, 5, 10, 9).getTime())).toBe(true)
    expect(shouldShowTummyTimeReminder([at(8)], null, new Date(2026, 5, 10, 10).getTime())).toBe(false)
    expect(shouldShowTummyTimeReminder([at(8)], null, new Date(2026, 5, 10, 12).getTime())).toBe(true)
    expect(shouldShowTummyTimeReminder([at(8), at(11), at(14), at(17)], null, new Date(2026, 5, 10, 18).getTime())).toBe(false)
  })
})
