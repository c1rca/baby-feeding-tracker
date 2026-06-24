import { BellRing } from 'lucide-react'
import type { MedicineReminderSettings } from './modalTypes'

type GotifyReminderSettingProps = {
  gotifyAvailable: boolean
  gotifyRemindersEnabled: boolean
  medicineReminderSettings: MedicineReminderSettings
  setGotifyReminders: (enabled: boolean) => void | Promise<void>
  setMedicineReminderSettings: (settings: MedicineReminderSettings) => void | Promise<void>
}

const intervalOptions = [
  { value: '0', label: 'Off', helper: 'No dose reminder' },
  { value: '4', label: '4 hours', helper: 'Earlier follow-up' },
  { value: '6', label: '6 hours', helper: 'Default window' },
] as const

const medicines = [
  { kind: 'tylenol', label: 'Tylenol', tone: 'amber' },
  { kind: 'motrin', label: 'Motrin', tone: 'rose' },
] as const

export function GotifyReminderSetting({ gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, setGotifyReminders, setMedicineReminderSettings }: GotifyReminderSettingProps) {
  const updateMedicineInterval = (kind: keyof MedicineReminderSettings, value: string) => {
    void setMedicineReminderSettings({ ...medicineReminderSettings, [kind]: Number(value) as 0 | 4 | 6 })
  }

  const statusText = gotifyAvailable ? (gotifyRemindersEnabled ? 'On' : 'Off') : 'Not configured'

  return (
    <section className="notification-setting server-reminder-card" aria-labelledby="server-reminders-title">
      <div className="server-reminder-header">
        <div className="server-reminder-icon" aria-hidden="true"><BellRing size={18} /></div>
        <div>
          <div className="server-reminder-title-row">
            <strong id="server-reminders-title">Gotify reminders</strong>
            <span aria-label={`Gotify reminders status: ${statusText}`} className={`server-reminder-status ${gotifyRemindersEnabled ? 'is-on' : ''}`}>{statusText}</span>
          </div>
          <p className="muted">Server-side Gotify/SMS reminders that still work when this page is closed.</p>
        </div>
        <button
          type="button"
          className={gotifyRemindersEnabled ? 'server-reminder-toggle' : 'server-reminder-toggle primary'}
          disabled={!gotifyAvailable}
          onClick={() => void setGotifyReminders(!gotifyRemindersEnabled)}
        >
          {gotifyRemindersEnabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      <div className="medicine-reminder-settings" aria-label="Medicine reminder intervals">
        {medicines.map(({ kind, label, tone }) => (
          <label className={`medicine-reminder-control medicine-reminder-${tone}`} key={kind}>
            <span className="medicine-reminder-label">
              <strong>{label}</strong>
              <small>{medicineReminderSettings[kind] === 0 ? 'Reminder disabled' : `Remind ${medicineReminderSettings[kind]}h after latest dose`}</small>
            </span>
            <span className="medicine-reminder-select-wrap">
              <select
                aria-label={`${label} reminder interval`}
                disabled={!gotifyAvailable}
                value={String(medicineReminderSettings[kind])}
                onChange={(event) => updateMedicineInterval(kind, event.target.value)}
              >
                {intervalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}
