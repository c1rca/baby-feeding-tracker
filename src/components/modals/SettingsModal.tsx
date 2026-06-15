import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'
import { BrowserReminderSetting } from './BrowserReminderSetting'
import { GotifyReminderSetting } from './GotifyReminderSetting'
import { SettingsDataControls } from './SettingsDataControls'

type SettingsModalProps = Pick<
  TrackerModalsProps,
  | 'entries'
  | 'diapers'
  | 'feedingNotificationsEnabled'
  | 'notificationPermission'
  | 'gotifyAvailable'
  | 'gotifyRemindersEnabled'
  | 'fileInputRef'
  | 'setSettingsOpen'
  | 'setEntries'
  | 'setDiapers'
  | 'setSession'
  | 'setUndoState'
  | 'setFeedingNotificationsEnabled'
  | 'enableFeedingNotifications'
  | 'setGotifyReminders'
  | 'showToast'
>

export function SettingsModal({ entries, diapers, feedingNotificationsEnabled, notificationPermission, gotifyAvailable, gotifyRemindersEnabled, fileInputRef, setSettingsOpen, setEntries, setDiapers, setSession, setUndoState, setFeedingNotificationsEnabled, enableFeedingNotifications, setGotifyReminders, showToast }: SettingsModalProps) {
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
        setGotifyReminders={setGotifyReminders}
      />
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
