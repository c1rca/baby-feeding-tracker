import { Bell, Pill, Clock, Moon } from 'lucide-react'
import type { NotificationPreferences } from '../../../state/notificationPreferences'
import { SettingToggle } from '../SettingToggle'
import { ChannelSelector } from './ChannelSelector'
import { HourRange } from './HourRange'

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
  { key: 'feeding' as const, label: 'Feeding', icon: Bell, hasInterval: false },
  { key: 'tylenol' as const, label: 'Tylenol', icon: Pill, hasInterval: true },
  { key: 'motrin' as const, label: 'Motrin', icon: Pill, hasInterval: true },
  { key: 'vitaminD' as const, label: 'Vitamin D', icon: Pill, hasInterval: false },
  { key: 'tummyTime' as const, label: 'Tummy Time', icon: Clock, hasInterval: false },
] as const

const intervalOptions = [
  { value: 0, label: 'Off' },
  { value: 4, label: '4 hours' },
  { value: 6, label: '6 hours' },
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

  const updateChannelPrefs = (type: keyof Omit<NotificationPreferences, 'tummyActiveHours' | 'quietHours' | 'medicineIntervals'>, prefs: any) => {
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

  const toggleQuietHours = (enabled: boolean) => {
    setNotificationPreferences({
      quietHours: {
        ...notificationPreferences.quietHours,
        enabled,
      },
    })
  }

  const updateQuietHoursWindow = (window: any) => {
    setNotificationPreferences({
      quietHours: {
        ...notificationPreferences.quietHours,
        ...window,
      },
    })
  }

  const updateTummyActiveHours = (window: any) => {
    setNotificationPreferences({ tummyActiveHours: window })
  }

  return (
    <div className="notif-settings-container">
      {/* Per-type reminder cards */}
      {notificationTypes.map(({ key, label, icon: Icon, hasInterval }) => {
        const prefs = notificationPreferences[key]
        const interval = hasInterval ? notificationPreferences.medicineIntervals[key as 'tylenol' | 'motrin'] : undefined

        return (
          <div key={key} className="settings-card notif-type-card">
            <div className="notif-type-header">
              <div className="notif-type-title">
                <Icon size={18} aria-hidden="true" className="notif-type-icon" />
                <strong>{label}</strong>
              </div>
            </div>

            <div className="setting-row">
              <span className="setting-row-text">
                <small>Delivery channels</small>
              </span>
              <ChannelSelector
                prefs={prefs}
                onChange={(next) => updateChannelPrefs(key, next)}
                label={label}
              />
            </div>

            {hasInterval && (
              <div className="setting-row">
                <span className="setting-row-text">
                  <small>Reminder timing</small>
                </span>
                <span className="settings-select">
                  <select
                    aria-label={`${label} reminder interval`}
                    value={interval}
                    onChange={(e) => updateMedicineInterval(key as 'tylenol' | 'motrin', Number(e.target.value) as 0 | 4 | 6)}
                  >
                    {intervalOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
            )}

            {key === 'tummyTime' && (
              <div className="setting-row">
                <span className="setting-row-text">
                  <small>Active hours</small>
                </span>
                <HourRange
                  window={notificationPreferences.tummyActiveHours}
                  onChange={updateTummyActiveHours}
                  label="Tummy Time active hours"
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Quiet hours card */}
      <div className="settings-card notif-quiet-hours-card">
        <div className="notif-quiet-header">
          <div className="notif-quiet-title">
            <Moon size={18} aria-hidden="true" className="notif-quiet-icon" />
            <strong>Quiet hours</strong>
          </div>
          <SettingToggle
            checked={notificationPreferences.quietHours.enabled}
            onChange={toggleQuietHours}
            label="Enable quiet hours"
          />
        </div>

        {notificationPreferences.quietHours.enabled && (
          <div className="setting-row">
            <span className="setting-row-text">
              <small>Silence all notifications during</small>
            </span>
            <HourRange
              window={notificationPreferences.quietHours}
              onChange={updateQuietHoursWindow}
              label="Quiet hours window"
              disabled={!notificationPreferences.quietHours.enabled}
            />
          </div>
        )}
      </div>

      {/* This device card */}
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
