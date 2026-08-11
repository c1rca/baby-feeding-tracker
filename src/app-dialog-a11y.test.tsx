import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'

describe('dialogs behave the same for a keyboard user', () => {
  setupAppTestEnvironment()

  it('moves focus into a care sheet and closes it on Escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    const opener = screen.getByRole('button', { name: /^Medicine$/i })
    await user.click(opener)

    const sheet = screen.getByRole('dialog', { name: /Log medicine/i })
    expect(sheet.contains(document.activeElement)).toBe(true)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Log medicine/i })).toBeNull()
    // Focus returns to whatever opened it, not to the top of the page.
    expect(document.activeElement).toBe(opener)
  })

  it('keeps Tab inside the dialog rather than escaping to the page behind it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Bottle$/i }))
    const sheet = screen.getByRole('dialog', { name: /Quick bottle log/i })

    // Walk well past the number of controls in the sheet; focus must wrap.
    for (let press = 0; press < 25; press += 1) {
      await user.tab()
      expect(sheet.contains(document.activeElement)).toBe(true)
    }
  })

  it('closes the settings modal on Escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Open settings/i }))
    expect(screen.getByRole('dialog', { name: /Settings and data/i })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Settings and data/i })).toBeNull()
  })

  it('gives the growth measurement form a dialog role with focus handling', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Insights$/i }))
    await user.click(await screen.findByRole('button', { name: /Add measurement/i }))

    const dialog = screen.getByRole('dialog', { name: /Add growth measurement/i })
    expect(dialog.contains(document.activeElement)).toBe(true)
    // The form is still addressable for anything that queried it before.
    expect(within(dialog).getByRole('form', { name: /Add growth measurement/i })).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Add growth measurement/i })).toBeNull()
  })
})

// On a phone the settings rail collapses to icons only for every tab except the
// active one, so two tabs sharing a glyph are genuinely indistinguishable.
// Profile and Baby both used the Baby icon: picking the wrong one landed you on
// a page with a name field and no trackers, which reads as "it's broken".
describe('settings tabs are told apart by their icons alone', () => {
  setupAppTestEnvironment()

  it('gives every tab a distinct icon', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: /Open settings|Settings/i })[0])

    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(3)
    const glyphs = tabs.map((tab) => tab.querySelector('.settings-tab-icon svg')?.getAttribute('class') ?? '')
    expect(glyphs.every(Boolean)).toBe(true)
    expect(new Set(glyphs).size).toBe(glyphs.length)
  })
})
