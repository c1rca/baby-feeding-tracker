import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import {
  STORAGE_KEY,
  STORAGE_SESSION_KEY,
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

  it('keeps diaper logging primary while missed feed stays in additional options', async () => {
    const user = userEvent.setup()
    render(<App />)

    const hero = document.querySelector('.hero') as HTMLElement
    const diaperPanel = screen.getByRole('group', { name: /Diaper/i })
    expect(hero.compareDocumentPosition(diaperPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Add missed feed/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    expect(screen.getByRole('button', { name: /Add missed feed/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /Select wet diaper/i }))
    await user.click(screen.getByRole('button', { name: /Select stool diaper/i }))
    await user.click(screen.getByRole('button', { name: /Log selected diapers/i }))

    expect(screen.getByText(/Wet \+ Stool diaper logged/i)).toBeTruthy()
    expect(screen.getByText(/Diapers today/i).nextElementSibling?.textContent).toContain('1 wet')
    expect(screen.getByText(/Diapers today/i).nextElementSibling?.textContent).toContain('1 stool')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getAllByText(/Wet \+ Stool/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Outside feed/i)).toBeNull()
    expect(screen.queryByText(/Attached to active feed/i)).toBeNull()
  })

  it('undoes a standalone diaper log from the timeline toast', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Select wet diaper/i }))
    await user.click(screen.getByRole('button', { name: /Log selected diapers/i }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Undo diaper log/i }))

    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.getByText(/Diaper log undone/i)).toBeTruthy()
  })

  it('edits and deletes standalone diaper entries from timeline actions', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Select wet diaper/i }))
    await user.click(screen.getByRole('button', { name: /Log selected diapers/i }))
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

  it('logs active-feed diaper selections immediately when Log is pressed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    await user.click(screen.getByRole('button', { name: /Select wet during active feed/i }))
    await user.click(screen.getByRole('button', { name: /Select stool during active feed/i }))
    await user.click(screen.getByRole('button', { name: /Log selected diapers/i }))

    expect(screen.getByText(/Wet \+ Stool diaper logged/i)).toBeTruthy()
    const immediateItems = screen.getAllByRole('listitem')
    expect(immediateItems).toHaveLength(1)
    expect(within(immediateItems[0]).getByText(/Wet \+ Stool/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /End feed/i }))
    const savedItems = screen.getAllByRole('listitem')
    expect(savedItems).toHaveLength(2)
    expect(within(savedItems[0]).getByText(/Wet \+ Stool/i)).toBeTruthy()
    expect(within(savedItems[1]).queryByText(/Wet \+ Stool/i)).toBeNull()
    expect(screen.queryByText(/Attached to active feed/i)).toBeNull()
    expect(screen.queryByText(/Outside feed/i)).toBeNull()
  })

  it('still allows immediate standalone diaper logging when the active feed already has pending diaper selections', async () => {
    const user = userEvent.setup()
    const now = Date.now()
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({
      startedAt: now - 5 * 60 * 1000,
      activeSide: 'left',
      segments: [{ side: 'left', startedAt: now - 5 * 60 * 1000, endedAt: null }],
      bottleOunces: 0,
      note: '',
      diaperKinds: ['wet', 'stool'],
    }))

    render(<App />)

    await user.click(screen.getByRole('button', { name: /Select wet during active feed/i }))
    await user.click(screen.getByRole('button', { name: /Select stool during active feed/i }))
    await user.click(screen.getByRole('button', { name: /Log selected diapers/i }))

    expect(screen.getByText(/Wet \+ Stool diaper logged/i)).toBeTruthy()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText(/Wet \+ Stool/i)).toBeTruthy()
  })

  it('includes selected active-feed diapers when saving if Log was not pressed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Start suggested side: Left/i }))
    await user.click(screen.getByRole('button', { name: /Select wet during active feed/i }))
    await user.click(screen.getByRole('button', { name: /Select stool during active feed/i }))

    await user.click(screen.getByRole('button', { name: /End feed/i }))

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(within(items[0]).getByText(/Wet \+ Stool/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Select stool during active feed/i })).toBeNull()
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
