import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationSettings } from './NotificationSettings'
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '../../../state/notificationPreferences'

const setup = (over: Partial<NotificationPreferences> = {}, props: Partial<Parameters<typeof NotificationSettings>[0]> = {}) => {
  const setNotificationPreferences = vi.fn()
  render(
    <NotificationSettings
      notificationPreferences={{ ...DEFAULT_NOTIFICATION_PREFERENCES, ...over }}
      browserRemindersEnabled
      notificationPermission="granted"
      gotifyAvailable
      setNotificationPreferences={setNotificationPreferences}
      setBrowserRemindersEnabled={() => {}}
      enableBrowserReminders={() => {}}
      showToast={() => {}}
      {...props}
    />,
  )
  return { setNotificationPreferences }
}

const row = (name: RegExp) => screen.getByRole('button', { name })

describe('the notifications page states what will actually happen', () => {
  afterEach(cleanup)

  it('summarises each reminder without needing to be opened', () => {
    setup()
    // Feeding ships browser+gotify on, every 2 hours.
    expect(row(/^Feeding/).textContent).toMatch(/Every 2h/)
    expect(row(/^Feeding/).textContent).toMatch(/Browser/)
    expect(row(/^Tylenol/).textContent).toMatch(/Every 6h/)
    // Custom trackers keep their schedule per tracker, so there is no interval.
    expect(row(/^Your trackers/).textContent).toMatch(/Per tracker/)
  })

  it('says Off when nothing would be delivered', () => {
    setup({ feeding: { inApp: false, browser: false, gotify: false } })
    expect(row(/^Feeding/).textContent).toMatch(/Off/)
  })

  it('counts what is on in the status strip', () => {
    setup()
    expect(within(screen.getByLabelText('Notification status')).getByText(/of 6 on/)).toBeTruthy()
  })

  it('reports this device as blocked rather than merely off', () => {
    setup({}, { notificationPermission: 'denied', browserRemindersEnabled: false })
    expect(screen.getByText(/This device blocked/)).toBeTruthy()
    expect(screen.getByText(/Blocked in your browser settings/i)).toBeTruthy()
  })

  // The per-type Browser switch used to look on while this device delivered
  // nothing. It now says so, in the summary and on the switch itself.
  it('marks the browser channel muted when this device cannot deliver', async () => {
    const user = userEvent.setup()
    setup({}, { browserRemindersEnabled: false, notificationPermission: 'default' })
    expect(row(/^Feeding/).textContent).toMatch(/Browser \(muted\)/)

    await user.click(row(/^Feeding/))
    const browserSwitch = screen.getByRole('switch', { name: /Feeding via Browser/i })
    expect((browserSwitch as HTMLButtonElement).disabled).toBe(true)
    expect(browserSwitch.getAttribute('aria-label')).toMatch(/Turn on Browser reminders/i)
  })

  it('opens one reminder at a time', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(row(/^Feeding/))
    expect(row(/^Feeding/).getAttribute('aria-expanded')).toBe('true')
    await user.click(row(/^Tylenol/))
    expect(row(/^Feeding/).getAttribute('aria-expanded')).toBe('false')
    expect(row(/^Tylenol/).getAttribute('aria-expanded')).toBe('true')
  })

  it('shows the quiet window only while quiet hours are on, and states it up top', async () => {
    const user = userEvent.setup()
    const { setNotificationPreferences } = setup({ quietHours: { enabled: false, startHour: 22, startMinute: 0, endHour: 7, endMinute: 0 } })
    expect(screen.queryByLabelText('Quiet hours window')).toBeNull()

    await user.click(screen.getByRole('switch', { name: /Enable quiet hours/i }))
    expect(setNotificationPreferences).toHaveBeenCalledWith(expect.objectContaining({ quietHours: expect.objectContaining({ enabled: true }) }))

    cleanup()
    setup({ quietHours: { enabled: true, startHour: 22, startMinute: 0, endHour: 7, endMinute: 0 } })
    expect(screen.getByLabelText('Quiet hours window')).toBeTruthy()
    expect(screen.getByText(/Quiet 10:00 PM–7:00 AM/)).toBeTruthy()
  })

  it('does not offer a channel the server cannot use', async () => {
    const user = userEvent.setup()
    setup({}, { gotifyAvailable: false })
    await user.click(row(/^Your trackers/))
    // Gotify is scheduled server-side and knows nothing about custom trackers.
    expect(screen.queryByRole('switch', { name: /Your trackers via Gotify/i })).toBeNull()
    expect(screen.getByText(/Gotify is not configured/i)).toBeTruthy()
  })
})
