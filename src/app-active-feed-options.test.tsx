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

  it('keeps missed feed available inside additional options during an active feed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side/i }))
    await user.click(screen.getByRole('button', { name: /Additional options/i }))

    const missedGroup = screen.getByRole('group', { name: /Missed feed/i })
    await user.click(within(missedGroup).getByRole('button', { name: /Add missed feed/i }))
    expect(screen.getByRole('dialog', { name: /Add missed feed/i })).toBeTruthy()
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
    expect(briefText).toMatch(/Next feed\s*10:00.*11:00.*AM\s*Left\s*in 30m/i)
    const nextSide = document.querySelector('.next-feed-side') as HTMLElement
    expect(nextSide?.textContent?.trim()).toBe('Left')
    expect(nextSide?.className).toBe('next-feed-side')
  })

  it('adds a missed manual feed with bottle and nursing details from the entered start time', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(screen.getByRole('button', { name: /Add missed feed/i }))
    await user.clear(screen.getByLabelText(/Feed date/i))
    await user.type(screen.getByLabelText(/Feed date/i), '2026-06-10')
    await user.clear(screen.getByLabelText(/Feed start time/i))
    await user.type(screen.getByLabelText(/Feed start time/i), '08:00')
    await user.clear(screen.getByLabelText(/Manual bottle ounces/i))
    await user.type(screen.getByLabelText(/Manual bottle ounces/i), '2.5')
    await user.clear(screen.getByLabelText(/Manual left minutes/i))
    await user.type(screen.getByLabelText(/Manual left minutes/i), '7')
    await user.clear(screen.getByLabelText(/Manual right minutes/i))
    await user.type(screen.getByLabelText(/Manual right minutes/i), '5')
    await user.type(screen.getByLabelText(/Manual note/i), 'late log')
    await user.click(screen.getByRole('button', { name: /Save missed feed/i }))

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Entry[]
    expect(saved[0].startedAt).toBe(new Date('2026-06-10T08:00:00').getTime())
    expect(saved[0].endedAt).toBe(new Date('2026-06-10T08:12:00').getTime())
    expect(screen.getByText(/Missed feed saved/i)).toBeTruthy()
  })
})
