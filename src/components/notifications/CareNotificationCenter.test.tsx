import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CareNotificationCenter } from './CareNotificationCenter'
import type { CareNotification } from './notificationModel'

const item = (overrides: Partial<CareNotification> = {}): CareNotification => ({
  id: 'tylenol', kind: 'medicine', priority: 1, title: 'Medicine reminder', summary: 'Take Tylenol now.', actionLabel: 'Log Tylenol', ariaActionLabel: 'Log Tylenol now', announcedRole: 'alert', dismissible: true, occurredAt: 1, action: vi.fn(), dismiss: vi.fn(), ...overrides,
})

describe('CareNotificationCenter', () => {
  it('keeps the priority action visible and reveals all notifications in an accessible inbox', async () => {
    const user = userEvent.setup()
    render(<CareNotificationCenter notifications={[item(), item({ id: 'vitamin', kind: 'vitamin_d', priority: 2, title: 'Vitamin D reminder', actionLabel: 'Log Vitamin D', ariaActionLabel: 'Log Vitamin D now' })]} />)

    expect(screen.getByRole('button', { name: /Open care notifications, 2 unresolved/i })).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Log Tylenol now/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Open care notifications, 2 unresolved/i }))
    expect(screen.getByRole('dialog', { name: /Care notifications/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Open care notifications, 2 unresolved/i }))
    expect(screen.queryByRole('dialog', { name: /Care notifications/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Open care notifications, 2 unresolved/i }))
    expect(screen.getByRole('dialog', { name: /Care notifications/i })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Care notifications/i })).toBeNull()
  })
})
