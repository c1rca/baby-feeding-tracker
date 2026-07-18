import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  STORAGE_KEY,
  STORAGE_SESSION_KEY,
  setupAppTestEnvironment,
} from './appTestSetup'

describe('App interactions', () => {
  setupAppTestEnvironment()

  it('end feed creates entry and persists to localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByRole('button', { name: /End feed/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /End feed/i }))

    expect(screen.getByText(/Feed saved/i)).toBeTruthy()
    const savedEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<{ id: string }>
    expect(savedEntries.length).toBe(1)
    expect(savedEntries[0].id).toBeTruthy()
    expect(localStorage.getItem(STORAGE_SESSION_KEY)).toBe('null')
  })

  it('suggests the opposite side from the last nursing feed and supports one-tap start', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-3',
          type: 'breast',
          startedAt: Date.now() - 120000,
          endedAt: Date.now() - 60000,
          leftSeconds: 0,
          rightSeconds: 120,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByText(/Suggested:/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByText(/On left/i)).toBeTruthy()
  })

  it('hides the live split until an active feed has multiple tracked inputs', async () => {
    vi.setSystemTime(new Date('2026-06-05T12:45:00'))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Adjust start time/i }))
    const startTime = screen.getByLabelText(/Session start time/i) as HTMLInputElement
    await user.clear(startTime)
    await user.type(startTime, '12:40pm')
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(screen.queryByLabelText(/Live split/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Bottle$/i }))
    await user.click(screen.getByRole('button', { name: /2\.0\s*ounces/i }))

    const liveSplit = screen.getByLabelText(/Live split/i)
    expect(liveSplit).toBeTruthy()
    expect(liveSplit.textContent).toMatch(/Left.*5m 00s/i)
    expect(liveSplit.textContent).toMatch(/Bottle.*2\.0 oz/i)
  })

  it('starts a session from a typed clock time and shows elapsed minutes', async () => {
    vi.setSystemTime(new Date('2026-06-05T12:45:00'))
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByLabelText(/Session start time/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /Adjust start time/i }))
    const startTime = screen.getByLabelText(/Session start time/i) as HTMLInputElement
    expect(startTime.value).toBe('12:45 PM')
    await user.clear(startTime)
    await user.type(startTime, '12:30pm')

    expect(screen.getAllByText(/15 min ago/i).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(screen.getAllByText(/15m 00s/i).length).toBeGreaterThan(0)
    const savedSession = JSON.parse(localStorage.getItem(STORAGE_SESSION_KEY) || 'null') as { startedAt: number; segmentStart: number }
    expect(savedSession.startedAt).toBe(new Date('2026-06-05T12:30:00').getTime())
    expect(savedSession.segmentStart).toBe(new Date('2026-06-05T12:30:00').getTime())
  })

  it('starts a session from the minutes-ago tab', async () => {
    vi.setSystemTime(new Date('2026-06-05T12:45:00'))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Adjust start time/i }))
    await user.click(screen.getByRole('tab', { name: /Minutes ago/i }))
    await user.clear(screen.getByLabelText(/Start minutes ago/i))
    await user.type(screen.getByLabelText(/Start minutes ago/i), '5')
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(screen.getAllByText(/5m 00s/i).length).toBeGreaterThan(0)
    const savedSession = JSON.parse(localStorage.getItem(STORAGE_SESSION_KEY) || 'null') as { startedAt: number }
    expect(savedSession.startedAt).toBe(new Date('2026-06-05T12:40:00').getTime())
  })

  it('resets a backdated start time after saving so the next feed starts now', async () => {
    vi.setSystemTime(new Date('2026-06-05T12:45:00'))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Adjust start time/i }))
    const startTime = screen.getByLabelText(/Session start time/i) as HTMLInputElement
    await user.clear(startTime)
    await user.type(startTime, '12:30pm')
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    await user.click(screen.getByRole('button', { name: /End feed/i }))

    vi.setSystemTime(new Date('2026-06-05T13:45:00'))
    await user.click(screen.getByRole('button', { name: /Start suggested side: Right/i }))

    const savedSession = JSON.parse(localStorage.getItem(STORAGE_SESSION_KEY) || 'null') as { startedAt: number }
    expect(savedSession.startedAt).toBe(new Date('2026-06-05T13:45:00').getTime())
    expect(screen.getAllByText(/0m 00s/i).length).toBeGreaterThan(0)
  })

  it('confirms before clearing an active feed and offers a 5 second undo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByText(/On left/i)).toBeTruthy()

    const clearActive = screen.getByRole('button', { name: /Clear active feed/i })
    expect(clearActive.className).toContain('active-clear-link')
    expect(clearActive.className).not.toContain('subtle-danger')

    await user.click(clearActive)

    expect(screen.getByRole('button', { name: /Confirm clear active feed/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /End feed/i })).toBeTruthy()
    expect(localStorage.getItem(STORAGE_SESSION_KEY)).not.toBe('null')

    await user.click(screen.getByRole('button', { name: /Confirm clear active feed/i }))

    expect(screen.getByText(/Active feed cleared/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Undo clear active feed/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /End feed/i })).toBeNull()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toHaveLength(0)
    expect(localStorage.getItem(STORAGE_SESSION_KEY)).toBe('null')

    await user.click(screen.getByRole('button', { name: /Undo clear active feed/i }))

    expect(screen.getByText(/Active feed restored/i)).toBeTruthy()
    expect(screen.getByText(/On left/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /End feed/i }).className).toContain('success')

    await user.click(screen.getByRole('button', { name: /Clear active feed/i }))
    await user.click(screen.getByRole('button', { name: /Confirm clear active feed/i }))
    vi.advanceTimersByTime(5000)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Undo clear active feed/i })).toBeNull())
  })

  it('requires confirmation before clearing all data', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-4',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 3,
          note: '',
        },
      ]),
    )
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Open settings/i }))
    await user.click(screen.getByRole('tab', { name: /Data/i }))
    await user.click(screen.getByRole('button', { name: /Clear all data/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.getAllByText(/3\.0 oz/i).length).toBeGreaterThan(0)
    confirmSpy.mockRestore()
  })

  it('uses explicit bottle copy during active nursing sessions', async () => {
    const user = userEvent.setup()
    render(<App />)

    // With no active feed the bottle launcher logs a standalone quick bottle.
    await user.click(screen.getByRole('button', { name: /^Bottle$/i }))
    expect(screen.getByRole('dialog', { name: /Quick bottle log/i })).toBeTruthy()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    // During an active feed the same launcher explicitly adds to the active feed.
    await user.click(screen.getByRole('button', { name: /^Bottle$/i }))
    expect(screen.getByRole('dialog', { name: /Add bottle to active feed/i })).toBeTruthy()
  })
})
