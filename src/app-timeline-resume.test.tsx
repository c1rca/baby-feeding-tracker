import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  STORAGE_KEY,
  setupAppTestEnvironment,
} from './appTestSetup'

describe('App interactions', () => {
  setupAppTestEnvironment()

  it('puts pause and resume on a compact timer-side transport control', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side/i }))

    const pauseToggle = screen.getByRole('button', { name: /Pause feed timer/i })
    expect(pauseToggle.className).toContain('transport-toggle')
    expect(pauseToggle.className).toContain('is-playing')
    expect(screen.queryByRole('button', { name: /^Pause$/i })).toBeNull()
    expect(screen.queryByText(/^Next feed$/i)).toBeNull()
    expect(document.querySelector('.next-feed-side')).toBeNull()

    await user.click(pauseToggle)

    expect(screen.getByText(/^Paused left$/i)).toBeTruthy()
    expect(screen.queryByText(/^Next feed$/i)).toBeNull()
    expect(document.querySelector('.next-feed-side')).toBeNull()
    const resumeToggle = screen.getByRole('button', { name: /Resume feed timer/i })
    expect(resumeToggle.className).toContain('is-paused')

    await user.click(screen.getByRole('button', { name: /Clear active feed/i }))
    await user.click(screen.getByRole('button', { name: /Confirm clear active feed/i }))
    expect(screen.getByText(/^Next feed$/i)).toBeTruthy()
  })

  it('resumes a saved timeline entry immediately on its saved side and offers undo', async () => {
    const endedAt = Date.now()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-resume',
          type: 'mixed',
          startedAt: endedAt - 900000,
          endedAt,
          leftSeconds: 420,
          rightSeconds: 300,
          bottleOunces: 2.5,
          note: 'resume me',
        },
      ]),
    )

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
    const scrollSpy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => undefined)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Resume session/i }))

    expect(screen.getByText(/Session resumed/i)).toBeTruthy()
    expect(screen.getByText(/On right/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Switch to Left/i })).toBeTruthy()
    const pauseToggle = screen.getByRole('button', { name: /Pause feed timer/i })
    expect(pauseToggle.className).toContain('transport-toggle')
    expect(pauseToggle.querySelector('svg')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Pause$/i })).toBeNull()
    expect(screen.getByRole('button', { name: /End feed/i }).querySelector('svg')).toBeNull()
    expect(screen.queryByRole('button', { name: /Resume Left/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Resume Right/i })).toBeNull()
    const liveSplit = screen.getByLabelText(/Live split/i)
    expect(within(liveSplit).getByText(/^Left$/i).nextElementSibling?.textContent).toMatch(/7m 00s/)
    expect(within(liveSplit).getByText(/^Right$/i).nextElementSibling?.textContent).toMatch(/5m 00s/)
    expect(within(liveSplit).getByText(/^Bottle$/i).nextElementSibling?.textContent).toBe('2.5 oz')
    await waitFor(() => expect(scrollSpy).toHaveBeenCalled())
    expect(document.activeElement?.textContent).toMatch(/Switch to Left/i)
    // The resumed feed's note rides the always-visible care note field.
    expect(screen.getByDisplayValue(/resume me/i)).toBeTruthy()
    expect(screen.queryByText(/mixed/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /Undo resume/i }))

    expect(screen.getByText(/Resume undone/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /End feed/i })).toBeNull()
    expect(screen.getByText(/mixed/i)).toBeTruthy()
  })

  it('does not resume an entry over an active session', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-resume-blocked',
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

    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Resume session/i }))

    expect(screen.getByText(/Finish or clear the active feed before resuming another entry/i)).toBeTruthy()
    expect(screen.getByText(/On left/i)).toBeTruthy()
    expect(within(firstItem).getByText(/bottle/i)).toBeTruthy()
  })

  it('shows inline resume only on the latest two timeline entries', () => {
    const base = Date.now()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        [0, 1, 2].map((index) => ({
          id: `entry-inline-${index}`,
          type: 'breast',
          startedAt: base - index * 600000 - 300000,
          endedAt: base - index * 600000,
          leftSeconds: 300,
          rightSeconds: 0,
          bottleOunces: null,
          note: '',
        })),
      ),
    )

    render(<App />)

    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByRole('button', { name: /Resume recent entry/i })).toBeTruthy()
    expect(within(items[1]).getByRole('button', { name: /Resume recent entry/i })).toBeTruthy()
    expect(within(items[2]).queryByRole('button', { name: /Resume recent entry/i })).toBeNull()
  })
})
