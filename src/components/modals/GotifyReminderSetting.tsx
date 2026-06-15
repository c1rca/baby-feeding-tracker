type GotifyReminderSettingProps = {
  gotifyAvailable: boolean
  gotifyRemindersEnabled: boolean
  setGotifyReminders: (enabled: boolean) => void | Promise<void>
}

export function GotifyReminderSetting({ gotifyAvailable, gotifyRemindersEnabled, setGotifyReminders }: GotifyReminderSettingProps) {
  return (
    <div className="notification-setting">
      <div>
        <strong>Gotify reminders</strong>
        <p className="muted">Server-side reminders that still work when this page is closed.</p>
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
    </div>
  )
}
