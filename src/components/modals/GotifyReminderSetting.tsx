import type { MedicineReminderSettings } from './modalTypes'
import { SettingToggle } from './SettingToggle'

type GotifyReminderSettingProps = {
  gotifyAvailable: boolean
  gotifyRemindersEnabled: boolean
  medicineReminderSettings: MedicineReminderSettings
  setGotifyReminders: (enabled: boolean) => void | Promise<void>
  setMedicineReminderSettings: (settings: MedicineReminderSettings) => void | Promise<void>
}

const intervalOptions = [
  { value: '0', label: 'Off' },
  { value: '4', label: '4 hours' },
  { value: '6', label: '6 hours' },
] as const

const medicines = [
  { kind: 'tylenol', label: 'Tylenol' },
  { kind: 'motrin', label: 'Motrin' },
] as const

export function GotifyReminderSetting({ gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, setGotifyReminders, setMedicineReminderSettings }: GotifyReminderSettingProps) {
  const updateMedicineInterval = (kind: keyof MedicineReminderSettings, value: string) => {
    void setMedicineReminderSettings({ ...medicineReminderSettings, [kind]: Number(value) as 0 | 4 | 6 })
  }

  return (
    <div className="settings-group">
      <p className="settings-group-label">Server reminders</p>
      <div className="settings-card">
        <div className="setting-row">
          <span className="setting-row-text">
            <strong>Gotify reminders</strong>
            <small>{gotifyAvailable ? 'Server-side reminders that arrive even when Feedr is closed' : 'Not configured on this server'}</small>
          </span>
          <SettingToggle checked={gotifyRemindersEnabled} onChange={(next) => void setGotifyReminders(next)} label="Gotify reminders" disabled={!gotifyAvailable} />
        </div>
        {medicines.map(({ kind, label }) => (
          <div className="setting-row" key={kind}>
            <span className="setting-row-text">
              <strong>{label} dose reminder</strong>
              <small>{medicineReminderSettings[kind] === 0 ? 'Off' : `Remind ${medicineReminderSettings[kind]}h after the latest dose`}</small>
            </span>
            <span className="settings-select">
              <select
                aria-label={`${label} reminder interval`}
                disabled={!gotifyAvailable}
                value={String(medicineReminderSettings[kind])}
                onChange={(event) => updateMedicineInterval(kind, event.target.value)}
              >
                {intervalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
