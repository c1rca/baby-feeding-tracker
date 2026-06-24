import type { MedicineReminderSettings } from './modalTypes'

type GotifyReminderSettingProps = {
  gotifyAvailable: boolean
  gotifyRemindersEnabled: boolean
  medicineReminderSettings: MedicineReminderSettings
  setGotifyReminders: (enabled: boolean) => void | Promise<void>
  setMedicineReminderSettings: (settings: MedicineReminderSettings) => void | Promise<void>
}

const intervalOptions = [
  { value: '0', label: 'Off' },
  { value: '4', label: 'Every 4 hours' },
  { value: '6', label: 'Every 6 hours' },
] as const

export function GotifyReminderSetting({ gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, setGotifyReminders, setMedicineReminderSettings }: GotifyReminderSettingProps) {
  const updateMedicineInterval = (kind: keyof MedicineReminderSettings, value: string) => {
    void setMedicineReminderSettings({ ...medicineReminderSettings, [kind]: Number(value) as 0 | 4 | 6 })
  }

  return (
    <div className="notification-setting notification-setting-stacked">
      <div>
        <strong>Gotify reminders</strong>
        <p className="muted">Server-side Gotify/SMS reminders that still work when this page is closed.</p>
        <small>Status: {gotifyAvailable ? (gotifyRemindersEnabled ? 'on' : 'off') : 'not configured'}</small>
      </div>
      <button
        type="button"
        className={gotifyRemindersEnabled ? '' : 'primary'}
        disabled={!gotifyAvailable}
        onClick={() => void setGotifyReminders(!gotifyRemindersEnabled)}
      >
        {gotifyRemindersEnabled ? 'Turn off' : 'Turn on'}
      </button>
      <div className="medicine-reminder-settings">
        <label>
          <span>Tylenol reminder interval</span>
          <select
            aria-label="Tylenol reminder interval"
            disabled={!gotifyAvailable}
            value={String(medicineReminderSettings.tylenol)}
            onChange={(event) => updateMedicineInterval('tylenol', event.target.value)}
          >
            {intervalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Motrin reminder interval</span>
          <select
            aria-label="Motrin reminder interval"
            disabled={!gotifyAvailable}
            value={String(medicineReminderSettings.motrin)}
            onChange={(event) => updateMedicineInterval('motrin', event.target.value)}
          >
            {intervalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}
