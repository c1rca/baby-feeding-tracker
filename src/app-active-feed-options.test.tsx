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

  it('keeps past-event logging available during an active feed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side/i }))
    await user.click(screen.getByRole('button', { name: /Log a past event/i }))
    expect(screen.getByRole('dialog', { name: /Log a past event/i })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: /End feed/i })).toBeTruthy()
  })

  it('shows the next feeding window two to three hours after the last feed start', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 5, 5, 9, 30))
    const startedAt = new Date(2026, 5, 5, 8, 0).getTime()
    const endedAt = new Date(2026, 5, 5, 11, 0).getTime()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-window',
          type: 'breast',
          startedAt,
          endedAt,
          leftSeconds: 300,
          rightSeconds: 300,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    render(<App />)

    expect(screen.getByText(/^Next feed$/i)).toBeTruthy()
    const briefText = document.querySelector('.today-brief')?.textContent || ''
    // 09:30 now, feed started 08:00: the range stays focal with the clock cue right below it
    expect(briefText).toMatch(/Next feed\s*10:00.*11:00\s*AM/i)
    expect(briefText).toMatch(/Next in 30m/i)
    const nextSide = document.querySelector('.next-feed-side') as HTMLElement
    expect(nextSide?.textContent?.trim()).toBe('L')
    expect(nextSide?.className).toBe('next-feed-side')
  })

  it('adds a past feed with bottle and nursing details from the entered start time', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Log a past event/i }))
    const dialog = screen.getByRole('dialog', { name: /Log a past event/i })
    await user.clear(within(dialog).getByLabelText(/^Date$/i))
    await user.type(within(dialog).getByLabelText(/^Date$/i), '2026-06-10')
    await user.clear(within(dialog).getByLabelText(/^Time$/i))
    await user.type(within(dialog).getByLabelText(/^Time$/i), '08:00')
    await user.clear(within(dialog).getByLabelText(/Bottle ounces/i))
    await user.type(within(dialog).getByLabelText(/Bottle ounces/i), '2.5')
    await user.clear(within(dialog).getByLabelText(/Left minutes/i))
    await user.type(within(dialog).getByLabelText(/Left minutes/i), '7')
    await user.clear(within(dialog).getByLabelText(/Right minutes/i))
    await user.type(within(dialog).getByLabelText(/Right minutes/i), '5')
    await user.type(within(dialog).getByLabelText(/^Note$/i), 'late log')
    await user.click(within(dialog).getByRole('button', { name: /Save past event/i }))

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Entry[]
    expect(saved[0].startedAt).toBe(new Date('2026-06-10T08:00:00').getTime())
    expect(saved[0].endedAt).toBe(new Date('2026-06-10T08:12:00').getTime())
    expect(screen.getByText(/Past feed saved/i)).toBeTruthy()
  })
})
