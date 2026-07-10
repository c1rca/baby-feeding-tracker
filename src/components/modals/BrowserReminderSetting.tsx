import { SettingToggle } from './SettingToggle'

type BrowserReminderSettingProps = {
  feedingNotificationsEnabled: boolean
  notificationPermission: NotificationPermission | 'default'
  setFeedingNotificationsEnabled: (enabled: boolean) => void
  enableFeedingNotifications: () => void | Promise<void>
  showToast: (message: string) => void
}

export function BrowserReminderSetting({ feedingNotificationsEnabled, notificationPermission, setFeedingNotificationsEnabled, enableFeedingNotifications, showToast }: BrowserReminderSettingProps) {
  const enabled = feedingNotificationsEnabled && notificationPermission === 'granted'
  const blocked = notificationPermission === 'denied'

  const toggle = (next: boolean) => {
    if (next) {
      void enableFeedingNotifications()
    } else {
      setFeedingNotificationsEnabled(false)
      showToast('Feeding reminders disabled')
    }
  }

  return (
    <div className="setting-row">
      <span className="setting-row-text">
        <strong>Next feeding reminders</strong>
        <small>Browser alerts 2 and 3 hours after each feed{blocked ? ' · Blocked in browser settings' : ''}</small>
      </span>
      <SettingToggle checked={enabled} onChange={toggle} label="Next feeding reminders" disabled={blocked} />
    </div>
  )
}
