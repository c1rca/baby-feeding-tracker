import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { setupAppTestEnvironment } from './appTestSetup'

describe('Pumping tracker', () => {
  setupAppTestEnvironment()

  it('records a selected-side pumping session through completion and exposes it in its own timeline workflow', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Additional options/i }))
    const pumping = screen.getByRole('group', { name: /Pumping/i })
    await user.click(within(pumping).getByRole('button', { name: /^Left pumping side$/i }))
    await user.click(within(pumping).getByRole('button', { name: /^Start pumping$/i }))

    expect(screen.getByText(/Pumping in progress/i)).toBeTruthy()
    expect(document.querySelector('.timer-mode-pill')?.textContent).toBe('Pumping')
    expect(screen.queryByRole('button', { name: /Start suggested side/i })).toBeNull()
    expect(screen.getByRole('button', { name: /^Stop pumping$/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^Stop pumping$/i }))
    const sheet = screen.getByRole('dialog', { name: /Complete pumping session/i })
    await user.type(within(sheet).getByRole('spinbutton', { name: /Left output ounces/i }), '3.5')
    expect(within(sheet).getByText(/Total output.*3\.5 oz/i)).toBeTruthy()
    await user.type(within(sheet).getByRole('textbox', { name: /Pumping note/i }), 'morning pump')
    await user.click(within(sheet).getByRole('button', { name: /Save pumping session/i }))

    expect(screen.getByText(/Pumping saved/i)).toBeTruthy()
    const pumpItem = screen.getAllByRole('listitem')[0]
    expect(within(pumpItem).getByText(/Pumping/i)).toBeTruthy()
    expect(within(pumpItem).getByText(/Left.*3\.5 oz/i)).toBeTruthy()
    expect(within(pumpItem).getByText('morning pump')).toBeTruthy()

    const filterGroup = screen.getByRole('group', { name: /Timeline filters/i })
    await user.click(within(filterGroup).getByRole('button', { name: /^Pumping$/i }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    await user.click(within(pumpItem).getByRole('button', { name: /Pumping actions/i }))
    await user.click(within(pumpItem).getByRole('menuitem', { name: /Edit pumping/i }))
    const right = within(pumpItem).getByRole('spinbutton', { name: /Right output ounces/i })
    await user.type(right, '1.5')
    await user.click(within(pumpItem).getByRole('button', { name: /Save pumping/i }))
    expect(within(pumpItem).getByText(/Total.*5 oz/i)).toBeTruthy()

    await user.click(within(pumpItem).getByRole('button', { name: /Pumping actions/i }))
    await user.click(within(pumpItem).getByRole('menuitem', { name: /Delete pumping/i }))
    await user.click(within(pumpItem).getByRole('menuitem', { name: /Confirm delete pumping/i }))
    expect(screen.queryByRole('listitem')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Undo pumping delete/i }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
