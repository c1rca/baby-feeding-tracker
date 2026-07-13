import { Bell, Pill, Clock, Moon } from 'lucide-react'
import { DEFAULT_NOTIFICATION_PREFERENCES, type ChannelPrefs, type HourWindow, type NotificationPreferences } from '../../../state/notificationPreferences'
import { SettingToggle } from '../SettingToggle'
import { ChannelSelector } from './ChannelSelector'
import { HourRange12h } from './HourRange12h'
import { ReminderTimingControl } from './ReminderTimingControl'

type NotificationSettingsProps = {
  notificationPreferences: NotificationPreferences
  browserRemindersEnabled: boolean
  notificationPermission: NotificationPermission | 'default'
  gotifyAvailable: boolean
  setNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void
  setBrowserRemindersEnabled: (enabled: boolean) => void
  enableBrowserReminders: () => void | Promise<void>
  showToast: (message: string) => void
}

const notificationTypes = [
  { key: 'feeding' as const, label: 'Feeding', icon: Bell, hasInterval: true },
  { key: 'tylenol' as const, label: 'Tylenol', icon: Pill, hasInterval: true },
  { key: 'motrin' as const, label: 'Motrin', icon: Pill, hasInterval: true },
  { key: 'vitaminD' as const, label: 'Vitamin D', icon: Pill, hasInterval: true },
  { key: 'tummyTime' as const, label: 'Tummy Time', icon: Clock, hasInterval: true },
] as const

export function NotificationSettings({
  notificationPreferences,
  browserRemindersEnabled,
  notificationPermission,
  gotifyAvailable,
  setNotificationPreferences,
  setBrowserRemindersEnabled,
  enableBrowserReminders,
  showToast,
}: NotificationSettingsProps) {
  const browserBlocked = notificationPermission === 'denied'

  const toggleBrowserReminders = (next: boolean) => {
    if (next) {
      void enableBrowserReminders()
    } else {
      setBrowserRemindersEnabled(false)
      showToast('Browser reminders disabled')
    }
  }

  const updateChannelPrefs = (type: keyof Omit<NotificationPreferences, 'tummyActiveHours' | 'quietHours' | 'medicineIntervals'>, prefs: ChannelPrefs) => {
    setNotificationPreferences({ [type]: prefs })
  }

  const updateMedicineInterval = (kind: 'tylenol' | 'motrin', value: number) => {
    setNotificationPreferences({
      medicineIntervals: {
        ...notificationPreferences.medicineIntervals,
        [kind]: value as 0 | 4 | 6,
      },
    })

  }

  const updateReminderInterval = (kind: 'feeding' | 'vitaminD' | 'tummyTime', value: number) => {
    setNotificationPreferences({ reminderIntervals: { ...DEFAULT_NOTIFICATION_PREFERENCES.reminderIntervals!, ...notificationPreferences.reminderIntervals, [kind]: value } })
  }

  const toggleQuietHours = (enabled: boolean) => {
    setNotificationPreferences({
      quietHours: {
        ...notificationPreferences.quietHours,
        enabled,
      },
    })

  }

  const updateQuietHoursWindow = (window: HourWindow) => {
    setNotificationPreferences({
      quietHours: {
        ...notificationPreferences.quietHours,
        ...window,
      },
    })

  }

  const updateTummyActiveHours = (window: HourWindow) => {
    setNotificationPreferences({ tummyActiveHours: window })
  }

  return (
    <div className="notif-settings-container">
      <p className="sr-only">
        Notification settings control how and when you receive reminders. Each reminder type (feeding, medicine, vitamin D, tummy time) can be delivered through three channels: in-app notifications, browser notifications, or server notifications. You can also configure quiet hours to silence all notifications during specific times, and set the active window for tummy time reminders.
      </p>

      {/* This device card - at the top */}
      <div className="settings-card notif-device-card">
        <div className="settings-group">
          <p className="settings-group-label">This device</p>
          <div className="setting-row">
            <span className="setting-row-text">
              <strong>Browser reminders</strong>
              <small>
                {browserBlocked
                  ? 'Blocked in browser settings'
                  : 'Deliver notifications on this device'}
              </small>
            </span>
            <SettingToggle
              checked={browserRemindersEnabled && notificationPermission === 'granted'}
              onChange={toggleBrowserReminders}
              label="Browser reminders"
              disabled={browserBlocked}
            />
          </div>
        </div>
      </div>

      <div className="settings-card notif-quiet-hours-card">
        <div className="notif-quiet-header">
          <div className="notif-quiet-title"><Moon size={18} aria-hidden="true" className="notif-quiet-icon" /><span><strong>Quiet hours</strong><small>Silence all reminders during this window</small></span></div>
          <SettingToggle checked={notificationPreferences.quietHours.enabled} onChange={toggleQuietHours} label="Enable quiet hours" />
        </div>
        {notificationPreferences.quietHours.enabled ? <HourRange12h window={notificationPreferences.quietHours} onChange={updateQuietHoursWindow} label="Quiet hours window" /> : null}
      </div>

      {/* Per-type reminder cards */}
      {notificationTypes.map(({ key, label, icon: Icon, hasInterval }) => {
        const prefs = notificationPreferences[key]
        const interval = key === 'tylenol' || key === 'motrin'
          ? notificationPreferences.medicineIntervals[key]
          : notificationPreferences.reminderIntervals?.[key as 'feeding' | 'vitaminD' | 'tummyTime']

        return (
          <div key={key} className="settings-card notif-type-card">
            <div className="notif-type-header">
              <div className="notif-type-title">
                <Icon size={18} aria-hidden="true" className="notif-type-icon" />
                <strong>{label}</strong>
              </div>
              <ChannelSelector prefs={prefs} onChange={(next) => updateChannelPrefs(key, next)} label={label} gotifyAvailable={gotifyAvailable} />
            </div>

            {hasInterval && interval !== undefined && (
              <div className="setting-row">
                <span className="setting-row-text">
                  <small>Reminder timing</small>
                </span>
                <ReminderTimingControl value={interval} label={label} presets={key === 'feeding' ? [2, 3, 4] : key === 'vitaminD' ? [12, 18, 24] : key === 'tummyTime' ? [1, 2, 3] : [4, 6, 8]} onChange={(value) => {
                  if (key === 'tylenol' || key === 'motrin') updateMedicineInterval(key, value)
                  else updateReminderInterval(key, value)
                }} />
              </div>
            )}

            {key === 'tummyTime' && (
              <div className="setting-row">
                <span className="setting-row-text">
                  <small>Active hours</small>
                </span>
                <HourRange12h
                  window={notificationPreferences.tummyActiveHours}
                  onChange={updateTummyActiveHours}
                  label="Tummy Time active hours"
                />
              </div>
            )}
          </div>
        )
      })}

      {!gotifyAvailable && (
        <div className="settings-card notif-unavailable-note">
          <p>
            <small>Gotify is not configured on this server. Server reminders are unavailable.</small>
          </p>
        </div>
      )}
    </div>
  )
}
