import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'
import { BrowserReminderSetting } from './BrowserReminderSetting'
import { GotifyReminderSetting } from './GotifyReminderSetting'
import { SettingsDataControls } from './SettingsDataControls'

type SettingsModalProps = Pick<
  TrackerModalsProps,
  | 'entries'
  | 'diapers'
  | 'babyDob'
  | 'feedingNotificationsEnabled'
  | 'notificationPermission'
  | 'gotifyAvailable'
  | 'gotifyRemindersEnabled'
  | 'medicineReminderSettings'
  | 'fileInputRef'
  | 'setSettingsOpen'
  | 'setEntries'
  | 'setDiapers'
  | 'setBabyDob'
  | 'setSession'
  | 'setUndoState'
  | 'setFeedingNotificationsEnabled'
  | 'enableFeedingNotifications'
  | 'setGotifyReminders'
  | 'setMedicineReminderSettings'
  | 'showToast'
>

export function SettingsModal({ entries, diapers, babyDob, feedingNotificationsEnabled, notificationPermission, gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, fileInputRef, setSettingsOpen, setEntries, setDiapers, setBabyDob, setSession, setUndoState, setFeedingNotificationsEnabled, enableFeedingNotifications, setGotifyReminders, setMedicineReminderSettings, showToast }: SettingsModalProps) {
  return (
    <ModalFrame label="Settings and data" className="settings" onClose={() => setSettingsOpen(false)}>
      <h2>Settings & Data</h2>
      <BrowserReminderSetting
        feedingNotificationsEnabled={feedingNotificationsEnabled}
        notificationPermission={notificationPermission}
        setFeedingNotificationsEnabled={setFeedingNotificationsEnabled}
        enableFeedingNotifications={enableFeedingNotifications}
        showToast={showToast}
      />
      <GotifyReminderSetting
        gotifyAvailable={gotifyAvailable}
        gotifyRemindersEnabled={gotifyRemindersEnabled}
        medicineReminderSettings={medicineReminderSettings}
        setGotifyReminders={setGotifyReminders}
        setMedicineReminderSettings={setMedicineReminderSettings}
      />
      <label className="setting-row">
        <span>
          <strong>Baby date of birth</strong>
          <small>Used to auto-calculate growth chart age.</small>
        </span>
        <input type="date" value={babyDob} onChange={(event) => setBabyDob(event.target.value)} />
      </label>
      <SettingsDataControls
        entries={entries}
        diapers={diapers}
        fileInputRef={fileInputRef}
        setEntries={setEntries}
        setDiapers={setDiapers}
        setSession={setSession}
        setUndoState={setUndoState}
        showToast={showToast}
      />
    </ModalFrame>
  )
}
