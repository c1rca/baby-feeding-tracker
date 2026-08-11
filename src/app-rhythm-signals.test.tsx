import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_DIAPERS_KEY, setupAppTestEnvironment } from './appTestSetup'

const TUMMY_KEY = 'baby-feeding-tracker:v1:tummy-times'
const DOB_KEY = 'baby-feeding-tracker:v1:baby-dob'

describe('rest and signals card', () => {
  setupAppTestEnvironment()

  // The card is hidden by default in this build; its behaviour is still worth
  // covering because the flag exists precisely to bring it back. The
  // default-hidden case is asserted in app-rhythm-signals-hidden.test.tsx.
  beforeEach(() => { vi.stubEnv('VITE_SHOW_RHYTHM_SIGNALS', '1') })
  afterEach(() => { vi.unstubAllEnvs() })

  const freezeClock = () => {
    const now = new Date(2026, 5, 30, 14, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    // Roughly two months old, so the wake window is 60–90 minutes.
    localStorage.setItem(DOB_KEY, '2026-04-30')
    return now
  }

  it('predicts the next nap from the last sleep', async () => {
    const now = freezeClock()
    localStorage.setItem(TUMMY_KEY, JSON.stringify([
      { id: 'nap', kind: 'sleep', startedAt: now - 80 * 60_000, endedAt: now - 20 * 60_000 },
    ]))
    render(<App />)

    const card = await screen.findByRole('region', { name: /Rest and signals/i })
    expect(within(card).getByText(/Wake window/i)).toBeTruthy()
    expect(within(card).getByText(/next nap around/i)).toBeTruthy()
  })

  it('flags being past the usual wake window', async () => {
    const now = freezeClock()
    localStorage.setItem(TUMMY_KEY, JSON.stringify([
      { id: 'nap', kind: 'sleep', startedAt: now - 200 * 60_000, endedAt: now - 150 * 60_000 },
    ]))
    render(<App />)

    const card = await screen.findByRole('region', { name: /Rest and signals/i })
    expect(within(card).getByText(/past the usual/i)).toBeTruthy()
  })

  it('raises a diaper gap and points at a clinician rather than diagnosing', async () => {
    const now = freezeClock()
    localStorage.setItem(STORAGE_DIAPERS_KEY, JSON.stringify([
      { id: 'old-wet', kinds: ['wet'], at: now - 8 * 60 * 60_000, context: 'standalone' },
    ]))
    render(<App />)

    const card = await screen.findByRole('region', { name: /Rest and signals/i })
    expect(within(card).getByText(/No wet diaper logged for 8h/i)).toBeTruthy()
    expect(within(card).getByText(/pediatrician/i)).toBeTruthy()
  })

  it('stays quiet after a recent wet diaper and can log one inline', async () => {
    const now = freezeClock()
    localStorage.setItem(STORAGE_DIAPERS_KEY, JSON.stringify([
      { id: 'recent-wet', kinds: ['wet'], at: now - 45 * 60_000, context: 'standalone' },
    ]))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    const card = await screen.findByRole('region', { name: /Rest and signals/i })
    expect(within(card).getByText(/Last wet diaper 45m ago/i)).toBeTruthy()
    expect(within(card).queryByText(/pediatrician/i)).toBeNull()

    await user.click(within(card).getByRole('button', { name: /Log a wet diaper/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_DIAPERS_KEY) ?? '[]')
    expect(stored.length).toBe(2)
  })
})
