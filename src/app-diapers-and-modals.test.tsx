import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import {
  STORAGE_KEY,
  setupAppTestEnvironment,
} from './appTestSetup'

describe('App interactions', () => {
  setupAppTestEnvironment()

  it('edits ounces and diapers in timeline item', async () => {
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
    await user.click(within(firstItem).getByRole('button', { name: /Entry actions/i }))
    await user.click(within(firstItem).getByRole('menuitem', { name: /Edit/i }))
    const ouncesInput = screen.getByPlaceholderText(/e\.g\. 2\.5/i)
    await user.clear(ouncesInput)
    await user.type(ouncesInput, '4.5')
    await user.click(screen.getByRole('button', { name: /Add wet diaper from entry/i }))
    await user.click(screen.getByRole('button', { name: /Add stool diaper from entry/i }))
    await user.click(screen.getByRole('button', { name: /Save/i }))

    expect(screen.getByText(/Entry updated/i)).toBeTruthy()
    expect(screen.getAllByText(/4\.5 oz/i).length).toBeGreaterThan(0)
    expect(within(firstItem).getByText(/Wet \+ Stool/i)).toBeTruthy()
    const savedEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<{ diaperKinds?: string[] }>
    expect(savedEntries[0].diaperKinds).toEqual(['wet', 'stool'])
  })

  it('moves instant diaper logs into More actions', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByRole('group', { name: /^Diapers$/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    const diapers = screen.getByRole('group', { name: /^Diapers$/i })
    expect(within(diapers).getByRole('button', { name: /^Log wet diaper$/i })).toBeTruthy()
    expect(within(diapers).getByRole('button', { name: /^Log stool diaper$/i })).toBeTruthy()
    await user.click(within(diapers).getByRole('button', { name: /^Log mixed diaper$/i }))

    expect(screen.getByText(/Wet \+ Stool diaper logged/i)).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('undoes a standalone diaper log from the timeline toast', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(within(screen.getByRole('group', { name: /^Diapers$/i })).getByRole('button', { name: /^Log wet diaper$/i }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Undo diaper log/i }))

    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.getByText(/Diaper log undone/i)).toBeTruthy()
  })

  it('edits and deletes standalone diaper entries from timeline actions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(within(screen.getByRole('group', { name: /^Diapers$/i })).getByRole('button', { name: /^Log wet diaper$/i }))
    const diaperItem = screen.getAllByRole('listitem')[0]

    await user.click(within(diaperItem).getByRole('button', { name: /Diaper actions/i }))
    await user.click(within(diaperItem).getByRole('menuitem', { name: /Edit diaper/i }))
    await user.click(within(diaperItem).getByRole('button', { name: /Select stool diaper/i }))
    await user.click(within(diaperItem).getByRole('button', { name: /Save diaper/i }))
    expect(within(diaperItem).getByText(/Wet \+ Stool/i)).toBeTruthy()

    await user.click(within(diaperItem).getByRole('button', { name: /Diaper actions/i }))
    await user.click(within(diaperItem).getByRole('menuitem', { name: /Delete diaper/i }))
    await user.click(within(diaperItem).getByRole('menuitem', { name: /Confirm delete diaper/i }))

    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.getByText(/Diaper deleted/i)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Undo diaper delete/i }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('closes modal workflows with Escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    await user.click(screen.getByRole('button', { name: /Add missed feed/i }))
    expect(screen.getByRole('dialog', { name: /Add missed feed/i })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Add missed feed/i })).toBeNull()
  })
})
