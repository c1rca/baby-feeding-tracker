import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const STORAGE_SESSION_KEY = 'baby-feeding-tracker:v1:session'
import App from './App'

const STORAGE_KEY = 'baby-feeding-tracker:v1:entries'

describe('App interactions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('logs a quick bottle entry and shows toast feedback', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /log bottle/i }))

    expect(screen.getByText(/Bottle feed saved/i)).toBeTruthy()
    expect(screen.getByText(/Feeds today/i).nextElementSibling?.textContent).toBe('1')
  })

  it('deletes and restores an entry with undo', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-1',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 3,
          note: 'test',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Delete entry/i }))
    expect(screen.getByText(/Entry deleted/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Undo delete/i }))
    expect(screen.getByText(/Deletion undone/i)).toBeTruthy()
    expect(screen.getAllByText(/3\.0 oz/i).length).toBeGreaterThan(0)
  })

  it('edits ounces in timeline item', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-2',
          type: 'bottle',
          startedAt: Date.now(),
          endedAt: Date.now(),
          leftSeconds: 0,
          rightSeconds: 0,
          bottleOunces: 2,
          note: '',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Edit/i }))
    const ouncesInput = screen.getByPlaceholderText(/e\.g\. 2\.5/i)
    await user.clear(ouncesInput)
    await user.type(ouncesInput, '4.5')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    expect(screen.getByText(/Entry updated/i)).toBeTruthy()
    expect(screen.getAllByText(/4\.5 oz/i).length).toBeGreaterThan(0)
  })

  it('end feed creates entry and persists to localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start Left/i }))
    expect(screen.getByRole('button', { name: /End feed/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /End feed/i }))

    expect(screen.getByText(/Feed saved/i)).toBeTruthy()
    const savedEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<{ id: string }>
    expect(savedEntries.length).toBe(1)
    expect(savedEntries[0].id).toBeTruthy()
    expect(localStorage.getItem(STORAGE_SESSION_KEY)).toBe('null')
  })
})
