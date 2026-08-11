import { useState } from 'react'
import { Bell, BellOff, ChevronDown, Clock, Moon, Pill, Smartphone, Sparkles } from 'lucide-react'
import { DEFAULT_NOTIFICATION_PREFERENCES, type ChannelPrefs, type HourWindow, type NotificationPreferences } from '../../../state/notificationPreferences'
import { SettingToggle } from '../SettingToggle'
import { ChannelSelector } from './ChannelSelector'
import { HourRange12h } from './HourRange12h'
import { ReminderTimingControl } from './ReminderTimingControl'
import { SettingsRow, SettingsSection } from '../settings/SettingsPrimitives'

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

type TypeKey = 'feeding' | 'tylenol' | 'motrin' | 'vitaminD' | 'tummyTime' | 'customTrackers'

/**
 * Grouped, because six identical cards in a row is a list you stop reading.
 * "When" carries what the app decides for you; "What you take" is the three
 * scheduled medicines; "Care" is everything else.
 */
const GROUPS: Array<{ heading: string; types: TypeKey[] }> = [
  { heading: 'Feeding', types: ['feeding'] },
  { heading: 'Medicines', types: ['tylenol', 'motrin', 'vitaminD'] },
  { heading: 'Care', types: ['tummyTime', 'customTrackers'] },
]

const META: Record<TypeKey, { label: string; icon: typeof Bell; presets?: number[]; hue: string }> = {
  feeding: { label: 'Feeding', icon: Bell, presets: [2, 3, 4], hue: 'var(--hue-breast)' },
  tylenol: { label: 'Tylenol', icon: Pill, presets: [4, 6, 8], hue: 'var(--hue-tylenol)' },
  motrin: { label: 'Motrin', icon: Pill, presets: [4, 6, 8], hue: 'var(--hue-motrin)' },
  vitaminD: { label: 'Vitamin D', icon: Pill, presets: [12, 18, 24], hue: 'var(--hue-vitamin)' },
  tummyTime: { label: 'Tummy Time', icon: Clock, presets: [1, 2, 3], hue: 'var(--hue-tummy)' },
  customTrackers: { label: 'Your trackers', icon: Sparkles, hue: 'var(--hue-pumping)' },
}

const CHANNEL_NAMES: Array<[keyof ChannelPrefs, string]> = [['inApp', 'In-app'], ['browser', 'Browser'], ['gotify', 'Gotify']]

const clock12 = (hour: number, minute = 0) =>
  new Date(2020, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

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
  const [openType, setOpenType] = useState<TypeKey | null>(null)
  const browserBlocked = notificationPermission === 'denied'
  const browserLive = browserRemindersEnabled && notificationPermission === 'granted'

  const toggleBrowserReminders = (next: boolean) => {
    if (next) {
      void enableBrowserReminders()
    } else {
      setBrowserRemindersEnabled(false)
      showToast('Browser reminders disabled')
    }
  }

  const updateChannelPrefs = (type: TypeKey, prefs: ChannelPrefs) => setNotificationPreferences({ [type]: prefs })

  const updateMedicineInterval = (kind: 'tylenol' | 'motrin', value: number) =>
    setNotificationPreferences({ medicineIntervals: { ...notificationPreferences.medicineIntervals, [kind]: value as 0 | 4 | 6 } })

  const updateReminderInterval = (kind: 'feeding' | 'vitaminD' | 'tummyTime', value: number) =>
    setNotificationPreferences({ reminderIntervals: { ...DEFAULT_NOTIFICATION_PREFERENCES.reminderIntervals!, ...notificationPreferences.reminderIntervals, [kind]: value } })

  const toggleQuietHours = (enabled: boolean) =>
    setNotificationPreferences({ quietHours: { ...notificationPreferences.quietHours, enabled } })

  const updateQuietHoursWindow = (window: HourWindow) =>
    setNotificationPreferences({ quietHours: { ...notificationPreferences.quietHours, ...window } })

  const updateTummyActiveHours = (window: HourWindow) => setNotificationPreferences({ tummyActiveHours: window })

  const intervalFor = (key: TypeKey) =>
    key === 'tylenol' || key === 'motrin'
      ? notificationPreferences.medicineIntervals[key]
      : key === 'customTrackers'
        ? undefined
        : notificationPreferences.reminderIntervals?.[key]

  // The one line that answers "so what actually happens?". Built from the same
  // prefs the delivery code reads, and it names the channel that is muted by
  // this device rather than pretending it is on.
  const summaryFor = (key: TypeKey) => {
    const prefs = notificationPreferences[key]
    const on = CHANNEL_NAMES.filter(([channel]) => prefs[channel])
      .filter(([channel]) => channel !== 'gotify' || gotifyAvailable)
    if (on.length === 0) return { text: 'Off', off: true }
    const names = on.map(([channel, name]) => (channel === 'browser' && !browserLive ? `${name} (muted)` : name))
    const interval = intervalFor(key)
    const when = key === 'customTrackers'
      ? 'Per tracker'
      : interval === 0 || interval === undefined ? 'When due' : `Every ${interval}h`
    return { text: `${when} · ${names.join(', ')}`, off: false }
  }

  const activeCount = (Object.keys(META) as TypeKey[]).filter((key) => !summaryFor(key).off).length
  const quiet = notificationPreferences.quietHours

  return (
    <div className="notif-settings">
      <p className="sr-only">
        Notification settings control how and when you receive reminders. Each reminder type can be delivered
        in-app, through browser notifications on this device, or through the server. Quiet hours silence
        everything during a window you choose. Expand a reminder to change how often it arrives and where it goes.
      </p>

      {/* Status strip: what is on, whether this device may show anything, and
          whether anything is currently silenced. */}
      <div className="notif-status" aria-label="Notification status">
        <span className={`notif-status-pill${activeCount > 0 ? ' is-on' : ''}`}>
          {activeCount > 0 ? <Bell size={14} /> : <BellOff size={14} />}
          <strong>{activeCount > 0 ? `${activeCount} of ${Object.keys(META).length} on` : 'All reminders off'}</strong>
        </span>
        <span className={`notif-status-pill${browserLive ? ' is-on' : browserBlocked ? ' is-blocked' : ''}`}>
          <Smartphone size={14} />
          <strong>{browserBlocked ? 'This device blocked' : browserLive ? 'This device allowed' : 'This device off'}</strong>
        </span>
        {quiet.enabled ? (
          <span className="notif-status-pill is-quiet">
            <Moon size={14} />
            <strong>Quiet {clock12(quiet.startHour, quiet.startMinute)}–{clock12(quiet.endHour, quiet.endMinute)}</strong>
          </span>
        ) : null}
      </div>

      <SettingsSection label="Delivery">
        <div className="settings-card">
          <SettingsRow
            icon={Smartphone}
            title="Browser reminders"
            hint={browserBlocked
              ? 'Blocked in your browser settings — allow notifications for this site to turn them back on.'
              : browserLive
                ? 'This device can show notifications even when Feedr is closed.'
                : 'Turn on to let this device show notifications. The Browser option below stays muted until you do.'}
            control={<SettingToggle checked={browserLive} onChange={toggleBrowserReminders} label="Browser reminders" disabled={browserBlocked} />}
          />
          <SettingsRow
            icon={Moon}
            title="Quiet hours"
            hint={quiet.enabled ? 'Nothing arrives inside this window, whatever is set below.' : 'Silence every reminder during a window you choose.'}
            control={<SettingToggle checked={quiet.enabled} onChange={toggleQuietHours} label="Enable quiet hours" />}
          >
            {quiet.enabled ? <HourRange12h window={quiet} onChange={updateQuietHoursWindow} label="Quiet hours window" /> : null}
          </SettingsRow>
        </div>
      </SettingsSection>

      {GROUPS.map(({ heading, types }) => (
        <SettingsSection label={heading} key={heading}>
          <div className="settings-card notif-type-list">
            {types.map((key) => {
              const { label, icon: Icon, presets, hue } = META[key]
              const prefs = notificationPreferences[key]
              const interval = intervalFor(key)
              const summary = summaryFor(key)
              const open = openType === key

              return (
                <div className={`notif-type${open ? ' is-open' : ''}`} key={key} style={{ '--notif-hue': hue } as React.CSSProperties}>
                  <button
                    type="button"
                    className="notif-type-summary"
                    aria-expanded={open}
                    aria-controls={`notif-panel-${key}`}
                    onClick={() => setOpenType(open ? null : key)}
                  >
                    <span className="notif-type-icon" aria-hidden="true"><Icon size={17} /></span>
                    <span className="notif-type-text">
                      <strong>{label}</strong>
                      <small className={summary.off ? 'is-off' : undefined}>{summary.text}</small>
                    </span>
                    <ChevronDown size={16} className="notif-type-chevron" aria-hidden="true" />
                  </button>

                  {open ? (
                    <div className="notif-type-panel" id={`notif-panel-${key}`}>
                      <div className="notif-panel-row">
                        <span className="notif-panel-label">Where it goes</span>
                        <ChannelSelector
                          prefs={prefs}
                          onChange={(next) => updateChannelPrefs(key, next)}
                          label={label}
                          gotifyAvailable={gotifyAvailable}
                          channels={key === 'customTrackers' ? ['inApp', 'browser'] : undefined}
                          unavailable={browserLive ? {} : { browser: browserBlocked ? 'Blocked in your browser settings' : 'Turn on Browser reminders under Delivery first' }}
                        />
                      </div>

                      {presets && interval !== undefined ? (
                        <div className="notif-panel-row">
                          <span className="notif-panel-label">How often</span>
                          <ReminderTimingControl
                            value={interval}
                            label={label}
                            presets={presets}
                            onChange={(value) => (key === 'tylenol' || key === 'motrin' ? updateMedicineInterval(key, value) : updateReminderInterval(key as 'feeding' | 'vitaminD' | 'tummyTime', value))}
                          />
                        </div>
                      ) : null}

                      {key === 'tummyTime' ? (
                        <div className="notif-panel-row">
                          <span className="notif-panel-label">Only between</span>
                          <HourRange12h window={notificationPreferences.tummyActiveHours} onChange={updateTummyActiveHours} label="Tummy Time active hours" />
                        </div>
                      ) : null}

                      {/* The schedule for these lives on each tracker, since that is what
                          differs between them. Gotify is scheduled server-side and knows
                          nothing about caregiver-defined trackers, so it is not offered. */}
                      {key === 'customTrackers' ? (
                        <p className="notif-panel-note">Each tracker keeps its own schedule in Settings › Baby. Reminders stop once that tracker's goal is met for the day.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </SettingsSection>
      ))}

      {!gotifyAvailable ? (
        <p className="notif-footnote">Gotify is not configured on this server, so server reminders are unavailable.</p>
      ) : null}
    </div>
  )
}
