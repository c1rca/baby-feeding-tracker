import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_MEDICINES_KEY, setupAppTestEnvironment } from './appTestSetup'

const TUMMY_STORAGE_KEY = 'baby-feeding-tracker:v1:tummy-times'

describe('caregiver today brief', () => {
  setupAppTestEnvironment()

  it('leads the idle page with the caregiver brief instead of the timer', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-05T14:00:00'))
    render(<App />)

    const brief = document.querySelector('.today-brief') as HTMLElement
    expect(brief).toBeTruthy()
    expect(brief.textContent).toMatch(/Good afternoon/i)
    expect(brief.textContent).toMatch(/Friday, June 5/i)
    expect(brief.textContent).toMatch(/Next feed/i)
    expect(brief.textContent).toMatch(/Today's needs/i)
    // the feed timer stays out of the way until something is being timed
    expect(document.querySelector('.timer-shell')).toBeNull()
    expect(brief.textContent).not.toMatch(/0m 00s/)
    // quick care stays reachable from the brief
    expect(screen.getByRole('group', { name: /Care action launcher/i })).toBeTruthy()
  })

  it('pulls up the live feed timer from the start button and returns to the brief after saving', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(document.querySelector('.today-brief')).toBeNull()
    expect(document.querySelector('.timer-shell.is-live')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Pause feed timer/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /End feed/i }))

    expect(document.querySelector('.timer-shell')).toBeNull()
    expect(document.querySelector('.today-brief')).toBeTruthy()
    expect(screen.getByText(/Feed saved/i)).toBeTruthy()
  })

  it('tracks vitamin D as a need and completes it from the one-tap log', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText(/Not given yet/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Log Vitamin D dose/i }))

    expect(screen.getByText(/Given at/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Log Vitamin D dose/i })).toBeNull()
    const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
    expect(saved[0]).toMatchObject({ kind: 'vitamin_d' })
  })

  it('shows tummy time progress toward the goal and celebrates when the goal is met', () => {
    const now = Date.now()
    localStorage.setItem(TUMMY_STORAGE_KEY, JSON.stringify([
      { id: 'tt-1', startedAt: now - 3_600_000, endedAt: now - 3_600_000 + 8 * 60_000, kind: 'tummy' },
    ]))
    const { unmount } = render(<App />)

    expect(screen.getByText(/8 of 20 min/i)).toBeTruthy()
    const progress = screen.getByRole('progressbar', { name: /Tummy time progress/i })
    expect(progress.getAttribute('aria-valuenow')).toBe('8')
    unmount()

    localStorage.setItem(TUMMY_STORAGE_KEY, JSON.stringify([
      { id: 'tt-2', startedAt: now - 3_600_000, endedAt: now - 3_600_000 + 22 * 60_000, kind: 'tummy' },
    ]))
    render(<App />)
    expect(screen.getByText(/Goal met with 22 min/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Start Tummy Time timer/i })).toBeNull()
  })

  it('starts a live tummy timer from the needs list and hands the page to the timer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start Tummy Time timer/i }))

    expect(document.querySelector('.today-brief')).toBeNull()
    expect(screen.getByText(/^Tummy Time$/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Stop & Save Tummy Time/i })).toBeTruthy()
  })

  it('surfaces a due medicine as an actionable need', async () => {
    const user = userEvent.setup()
    const sevenHoursAgo = Date.now() - 7 * 3_600_000
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'med-1', kind: 'tylenol', at: sevenHoursAgo }]))
    render(<App />)

    expect(screen.getByText(/Tylenol due/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Log Tylenol dose/i }))

    expect(screen.queryByText(/Tylenol due/i)).toBeNull()
    const saved = JSON.parse(localStorage.getItem(STORAGE_MEDICINES_KEY) ?? '[]')
    expect(saved).toHaveLength(2)
  })
})
