import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { STORAGE_KEY, setupAppTestEnvironment } from './appTestSetup'

const entry = (id: string, hoursAgo: number, note: string) => ({
  id, type: 'bottle', startedAt: Date.now() - hoursAgo * 3600_000, endedAt: Date.now() - hoursAgo * 3600_000,
  leftSeconds: 0, rightSeconds: 0, bottleOunces: 3, note,
})

const open = () => screen.getByRole('button', { name: /Search and jump to a date/i })

describe('finding things in the timeline', () => {
  setupAppTestEnvironment()

  const seed = () => localStorage.setItem(STORAGE_KEY, JSON.stringify([entry('a', 1, 'sleepy feed'), entry('b', 30, 'big burp')]))

  it('keeps search and the date picker out of the way until asked for', () => {
    seed()
    render(<App />)
    expect(screen.queryByRole('searchbox', { name: /Search timeline/i })).toBeNull()
    expect(screen.queryByLabelText(/Jump to date/i)).toBeNull()
    expect(open().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens on the magnifier and puts the cursor in the box', async () => {
    const user = userEvent.setup()
    seed()
    render(<App />)
    await user.click(open())

    const box = screen.getByRole('searchbox', { name: /Search timeline/i })
    expect(open().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(box)
    // Just "Search" — the old placeholder explained itself at length.
    expect(box.getAttribute('placeholder')).toBe('Search')
    expect(screen.getByLabelText(/Jump to date/i)).toBeTruthy()
  })

  it('still filters, and closing does not silently keep the filter hidden', async () => {
    const user = userEvent.setup()
    seed()
    render(<App />)
    await user.click(open())
    await user.type(screen.getByRole('searchbox', { name: /Search timeline/i }), 'burp')
    expect(screen.getByText(/big burp/i)).toBeTruthy()
    expect(screen.queryByText(/sleepy feed/i)).toBeNull()

    // Collapse it: the query is still on, so a chip says so and clears it.
    await user.click(open())
    expect(screen.queryByRole('searchbox', { name: /Search timeline/i })).toBeNull()
    const chips = screen.getByLabelText('Active timeline filters')
    expect(within(chips).getByRole('button', { name: /Clear search for burp/i })).toBeTruthy()
    expect(screen.queryByText(/sleepy feed/i)).toBeNull()

    await user.click(within(chips).getByRole('button', { name: /Clear search for burp/i }))
    expect(screen.getByText(/sleepy feed/i)).toBeTruthy()
    expect(screen.queryByLabelText('Active timeline filters')).toBeNull()
  })

  it('marks the toggle while a filter is active', async () => {
    const user = userEvent.setup()
    seed()
    render(<App />)
    await user.click(open())
    expect(open().className).not.toContain('is-active')
    await user.type(screen.getByRole('searchbox', { name: /Search timeline/i }), 'burp')
    expect(open().className).toContain('is-active')
  })

  it('clears the query with Escape without closing the panel', async () => {
    const user = userEvent.setup()
    seed()
    render(<App />)
    await user.click(open())
    await user.type(screen.getByRole('searchbox', { name: /Search timeline/i }), 'burp')
    await user.keyboard('{Escape}')
    expect((screen.getByRole('searchbox', { name: /Search timeline/i }) as HTMLInputElement).value).toBe('')
    expect(open().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/sleepy feed/i)).toBeTruthy()
  })
})
