import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Trash2 } from 'lucide-react'
import { ConfirmButton, SettingsRow, SettingsSection } from './SettingsPrimitives'

describe('the shared settings row', () => {
  afterEach(cleanup)

  it('puts every control in the same track, whatever the control is', () => {
    render(
      <div className="settings-card">
        <SettingsRow title="A" control={<input aria-label="a" />} />
        <SettingsRow title="B" control={<button>Do it</button>} />
        <SettingsRow title="C" control={<span className="settings-number"><input aria-label="c" /></span>} />
      </div>,
    )
    // The alignment rail is structural, not per-row styling: each control lives
    // in the same wrapper, so the CSS can hold one track width for all of them.
    const controls = document.querySelectorAll('.settings-row-control')
    expect(controls).toHaveLength(3)
    for (const control of controls) expect(control.parentElement?.className).toContain('settings-row-main')
  })

  it('names its section for assistive tech and shows the heading once', () => {
    render(<SettingsSection label="Units" lead="How amounts are shown."><div /></SettingsSection>)
    expect(screen.getByRole('region', { name: 'Units' })).toBeTruthy()
    expect(screen.getByText('Units')).toBeTruthy()
    expect(screen.getByText('How amounts are shown.')).toBeTruthy()
  })

  it('omits the icon slot entirely when a row has no icon', () => {
    render(<SettingsRow title="No icon" />)
    expect(document.querySelector('.settings-row-icon')).toBeNull()
  })
})

describe('two-step destructive actions', () => {
  afterEach(cleanup)

  it('arms on the first press and only acts on the second', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmButton label="Remove" confirmLabel="Confirm" ariaLabel="Remove Sam" onConfirm={onConfirm} icon={Trash2} />)

    await user.click(screen.getByRole('button', { name: 'Remove Sam' }))
    expect(onConfirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirm: Remove Sam' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disarms when it loses focus, so it cannot stay primed unnoticed', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<><ConfirmButton label="Remove" confirmLabel="Confirm" ariaLabel="Remove Sam" onConfirm={onConfirm} /><button>Elsewhere</button></>)

    await user.click(screen.getByRole('button', { name: 'Remove Sam' }))
    expect(screen.getByRole('button', { name: 'Confirm: Remove Sam' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(screen.getByRole('button', { name: 'Remove Sam' })).toBeTruthy()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('can be disabled outright', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmButton label="Archive" confirmLabel="Confirm" ariaLabel="Archive Ryan" onConfirm={onConfirm} disabled />)
    const button = screen.getByRole('button', { name: 'Archive Ryan' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    await user.click(button)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
