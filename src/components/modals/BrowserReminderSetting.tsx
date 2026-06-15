type BrowserReminderSettingProps = {
  feedingNotificationsEnabled: boolean
  notificationPermission: NotificationPermission | 'default'
  setFeedingNotificationsEnabled: (enabled: boolean) => void
  enableFeedingNotifications: () => void | Promise<void>
  showToast: (message: string) => void
}

export function BrowserReminderSetting({ feedingNotificationsEnabled, notificationPermission, setFeedingNotificationsEnabled, enableFeedingNotifications, showToast }: BrowserReminderSettingProps) {
  const enabled = feedingNotificationsEnabled && notificationPermission === 'granted'

  return (
    <div className="notification-setting">
      <div>
        <strong>Next feeding reminders</strong>
        <p className="muted">Browser/mobile notifications at 2 and 3 hours after each feed. Opens Feedr.</p>
        <small>Permission: {notificationPermission}</small>
      </div>
      {enabled ? (
        <button
          type="button"
          onClick={() => {
            setFeedingNotificationsEnabled(false)
            showToast('Feeding reminders disabled')
          }}
        >
          Turn off
        </button>
      ) : (
        <button type="button" className="primary" onClick={enableFeedingNotifications}>
          Enable reminders
        </button>
      )}
    </div>
  )
}
