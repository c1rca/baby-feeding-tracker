import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import {
  STORAGE_KEY,
  STORAGE_MEDICINES_KEY,
  setupAppTestEnvironment,
} from './appTestSetup'

describe('App interactions', () => {
  setupAppTestEnvironment()

  it('edits a medicine timeline entry kind and time', async () => {
    const now = Date.now()
    localStorage.setItem(STORAGE_MEDICINES_KEY, JSON.stringify([{ id: 'dose-1', kind: 'tylenol', at: now }]))

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Medicine actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Edit medicine/i }))
    await user.click(within(firstItem).getByRole('button', { name: /Select Vitamin D/i }))
    await user.clear(within(firstItem).getByLabelText(/Medicine time/i))
    await user.type(within(firstItem).getByLabelText(/Medicine time/i), '9:15 AM')
    await user.click(within(firstItem).getByRole('button', { name: /Save medicine/i }))

    expect(screen.getByText(/Medicine updated/i)).toBeTruthy()
    expect(within(firstItem).getAllByText(/^Vitamin D$/i).length).toBeGreaterThan(0)
    expect(within(firstItem).getByText(/9:15 AM/i)).toBeTruthy()
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
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Delete entry/i }))
    expect(within(firstItem).getByText(/Are you sure/i)).toBeTruthy()
    expect(screen.queryByText(/Entry deleted/i)).toBeNull()
    await user.click(within(firstItem).getByRole('menuitem', { name: /Confirm delete entry/i }))
    expect(screen.getByText(/Entry deleted/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Undo delete/i }))
    expect(screen.getByText(/Deletion undone/i)).toBeTruthy()
    expect(screen.getAllByText(/3\.0 oz/i).length).toBeGreaterThan(0)
  })

  it('closes a timeline action menu when clicking outside it', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-menu-outside-click',
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

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    expect(within(firstItem).getByRole('menuitem', { name: /Edit entry/i })).toBeTruthy()
    expect(firstItem.closest('.timeline-day')?.classList.contains('menu-open')).toBe(true)

    await user.click(screen.getByText(/Baby Feeding Tracker/i))

    expect(within(firstItem).queryByRole('menuitem', { name: /Edit entry/i })).toBeNull()
  })

  it('edits left and right nursing minutes in a timeline item', async () => {
    const baseStartedAt = Date.now() - 720000
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'entry-nursing-edit',
          type: 'breast',
          startedAt: baseStartedAt,
          endedAt: Date.now(),
          leftSeconds: 420,
          rightSeconds: 300,
          bottleOunces: null,
          note: '',
        },
      ]),
    )

    const user = userEvent.setup()
    render(<App />)

    const firstItem = screen.getAllByRole('listitem')[0]
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Edit/i }))
    await user.clear(screen.getByLabelText(/^Left minutes$/i))
    await user.type(screen.getByLabelText(/^Left minutes$/i), '9')
    await user.clear(screen.getByLabelText(/^Right minutes$/i))
    await user.type(screen.getByLabelText(/^Right minutes$/i), '4')
    await user.click(screen.getByRole('button', { name: /Save/i }))

    expect(screen.getByText(/Entry updated/i)).toBeTruthy()
    const updatedItem = screen.getAllByRole('listitem')[0]
    expect(within(updatedItem).getByText(/Left:\s+9m 00s/i)).toBeTruthy()
    expect(within(updatedItem).getByText(/Right:\s+4m 00s/i)).toBeTruthy()
    const savedEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<{ startedAt: number; endedAt: number; leftSeconds: number; rightSeconds: number }>
    expect(savedEntries[0].leftSeconds).toBe(540)
    expect(savedEntries[0].rightSeconds).toBe(240)
    expect(savedEntries[0].endedAt).toBe(baseStartedAt + 13 * 60 * 1000)
  })
})
