import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

    await user.click(screen.getByRole('button', { name: /Log bottle-only feed/i }))
    await user.click(screen.getByRole('button', { name: /^log bottle$/i }))

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

    expect(screen.getByText(/Suggested next: Left/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByText(/On left/i)).toBeTruthy()
  })

  it('shows a live left-right split while a feed is active', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))

    expect(screen.getByText(/Live split/i)).toBeTruthy()
    expect(screen.getByText(/^Left$/i).nextElementSibling?.textContent).toMatch(/0m/)
    expect(screen.getByText(/^Right$/i).nextElementSibling?.textContent).toMatch(/0m/)
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

    await user.click(screen.getByRole('button', { name: /Show settings/i }))
    await user.click(screen.getByRole('button', { name: /Clear all data/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(screen.getAllByText(/3\.0 oz/i).length).toBeGreaterThan(0)
    confirmSpy.mockRestore()
  })

  it('adds a missed manual feed with bottle and nursing details', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Add missed feed/i }))
    await user.clear(screen.getByLabelText(/Manual bottle ounces/i))
    await user.type(screen.getByLabelText(/Manual bottle ounces/i), '2.5')
    await user.clear(screen.getByLabelText(/Manual left minutes/i))
    await user.type(screen.getByLabelText(/Manual left minutes/i), '7')
    await user.clear(screen.getByLabelText(/Manual right minutes/i))
    await user.type(screen.getByLabelText(/Manual right minutes/i), '5')
    await user.type(screen.getByLabelText(/Manual note/i), 'late log')
    await user.click(screen.getByRole('button', { name: /Save missed feed/i }))

    expect(screen.getByText(/Missed feed saved/i)).toBeTruthy()
    expect(screen.getByText(/mixed/i)).toBeTruthy()
    expect(screen.getAllByText(/2\.5 oz/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/late log/i)).toBeTruthy()
  })

  it('uses explicit bottle copy during active nursing sessions', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: /Log bottle-only feed/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    expect(screen.getByRole('button', { name: /Add bottle to this feed/i })).toBeTruthy()
  })
})
