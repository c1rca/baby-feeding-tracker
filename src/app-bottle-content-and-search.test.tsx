import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_KEY, STORAGE_MEDICINES_KEY, setupAppTestEnvironment } from './appTestSetup'

describe('bottle contents', () => {
  setupAppTestEnvironment()

  it('records what was in the bottle and shows it on the timeline', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Bottle$/i }))
    const sheet = screen.getByRole('dialog', { name: /Quick bottle log/i })
    await user.click(within(sheet).getByRole('button', { name: /^Formula$/i }))
    await user.click(within(sheet).getByRole('button', { name: /Log bottle/i }))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(stored[0].bottleContent).toBe('formula')
    expect(screen.getAllByText(/formula/i).length).toBeGreaterThan(0)
  })

  it('defaults the next bottle to the last content chosen on this device', async () => {
    localStorage.setItem('baby-feeding-tracker:v1:last-bottle-content', 'formula')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Bottle$/i }))
    const sheet = screen.getByRole('dialog', { name: /Quick bottle log/i })
    expect(within(sheet).getByRole('button', { name: /^Formula$/i }).getAttribute('aria-pressed')).toBe('true')
  })

  it('leaves bottles logged before contents existed unlabelled', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'legacy-bottle', type: 'bottle', startedAt: Date.now() - 3_600_000, endedAt: Date.now() - 3_600_000, leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note: '' }]),
    )
    render(<App />)

    expect(screen.getAllByText(/3\.0 oz/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/3\.0 oz breast milk/i)).toBeNull()
  })
})

describe('timeline search', () => {
  setupAppTestEnvironment()

  it('finds a note far outside the rolling window and reports no matches distinctly', async () => {
    const now = new Date(2026, 5, 30, 12, 0).getTime()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(now)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'recent', type: 'breast', startedAt: now - 3_600_000, endedAt: now - 3_000_000, leftSeconds: 600, rightSeconds: 0, bottleOunces: null, note: 'ordinary feed' },
        { id: 'ancient', type: 'breast', startedAt: new Date(2026, 5, 2, 5, 0).getTime(), endedAt: new Date(2026, 5, 2, 5, 15).getTime(), leftSeconds: 900, rightSeconds: 0, bottleOunces: null, note: 'spat up a lot' },
      ]),
    )
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'tyl', kind: 'tylenol', at: now - 7_200_000 }]))

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    // Search and jump-to-date live behind the magnifier now.
    await user.click(screen.getByRole('button', { name: /Search and jump to a date/i }))
    const searchBox = screen.getByLabelText(/Search timeline/i)
    await user.type(searchBox, 'spat up')
    expect(screen.getByText(/spat up a lot/i)).toBeTruthy()
    expect(screen.queryByText(/ordinary feed/i)).toBeNull()

    await user.clear(searchBox)
    await user.type(searchBox, 'tylenol')
    expect(screen.getAllByText(/tylenol/i).length).toBeGreaterThan(0)

    await user.clear(searchBox)
    await user.type(searchBox, 'zzzznothing')
    expect(screen.getByText(/No events match/i)).toBeTruthy()
  })
})
