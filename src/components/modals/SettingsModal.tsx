import { useState } from 'react'
import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'
import { BrowserReminderSetting } from './BrowserReminderSetting'
import { GotifyReminderSetting } from './GotifyReminderSetting'
import { SettingsDataControls } from './SettingsDataControls'
import { applySkin, readSkin, skinLabel } from '../../skin'

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

function AppearanceSetting() {
  const [skin, setSkin] = useState(readSkin)
  const nextSkin = skin === 'lullaby' ? 'classic' : 'lullaby'

  return (
    <div className="setting-row">
      <span>
        <strong>Design</strong>
        <small>Current: {skinLabel[skin]}. Switch between the new Lullaby design and the classic look on this device.</small>
      </span>
      <button
        type="button"
        aria-label={`Switch to ${skinLabel[nextSkin]} design`}
        onClick={() => {
          applySkin(nextSkin)
          setSkin(nextSkin)
        }}
      >
        Use {skinLabel[nextSkin]}
      </button>
    </div>
  )
}

export function SettingsModal({ entries, diapers, babyDob, feedingNotificationsEnabled, notificationPermission, gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, fileInputRef, setSettingsOpen, setEntries, setDiapers, setBabyDob, setSession, setUndoState, setFeedingNotificationsEnabled, enableFeedingNotifications, setGotifyReminders, setMedicineReminderSettings, showToast }: SettingsModalProps) {
  const closeSettings = () => setSettingsOpen(false)

  return (
    <ModalFrame label="Settings and data" className="settings" onClose={closeSettings}>
      <div className="settings-modal-header">
        <h2>Settings & Data</h2>
        <button type="button" className="settings-close-button" aria-label="Close settings" onClick={closeSettings}>
          ×
        </button>
      </div>
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
      <AppearanceSetting />
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
