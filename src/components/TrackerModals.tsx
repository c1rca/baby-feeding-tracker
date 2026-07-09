import { useEffect, useRef } from 'react'
import { formatDateInput, formatTimeInput } from '../domain/trackerDomain'
import { BottleModal } from './modals/BottleModal'
import { ManualFeedModal } from './modals/ManualFeedModal'
import { SettingsModal } from './modals/SettingsModal'
import type { TrackerModalsProps } from './modals/modalTypes'

export function TrackerModals({
  bottleOpen,
  manualOpen,
  settingsOpen,
  session,
  bottleQuickOz,
  manualDraft,
  entries,
  diapers,
  babyDob,
  tummyGoalMinutes,
  feedingNotificationsEnabled,
  notificationPermission,
  gotifyAvailable,
  gotifyRemindersEnabled,
  medicineReminderSettings,
  fileInputRef,
  setBottleOpen,
  setManualOpen,
  setSettingsOpen,
  setBottleQuickOz,
  setManualDraft,
  setEntries,
  setDiapers,
  setBabyDob,
  setTummyGoalMinutes,
  setSession,
  setUndoState,
  setFeedingNotificationsEnabled,
  logBottle,
  saveManualFeed,
  enableFeedingNotifications,
  setGotifyReminders,
  setMedicineReminderSettings,
  showToast,
}: TrackerModalsProps) {
  const wasManualOpenRef = useRef(false)

  useEffect(() => {
    if (!manualOpen) {
      wasManualOpenRef.current = false
      return
    }
    if (wasManualOpenRef.current) return
    wasManualOpenRef.current = true
    const timestamp = new Date().getTime()
    setManualDraft({ ...manualDraft, date: formatDateInput(timestamp), time: formatTimeInput(timestamp) })
  }, [manualOpen, manualDraft, setManualDraft])

  return (
    <>
      {bottleOpen ? <BottleModal session={session} bottleQuickOz={bottleQuickOz} setBottleOpen={setBottleOpen} setBottleQuickOz={setBottleQuickOz} logBottle={logBottle} /> : null}
      {manualOpen ? <ManualFeedModal manualDraft={manualDraft} setManualDraft={setManualDraft} setManualOpen={setManualOpen} saveManualFeed={saveManualFeed} /> : null}
      {settingsOpen ? <SettingsModal entries={entries} diapers={diapers} babyDob={babyDob} tummyGoalMinutes={tummyGoalMinutes} feedingNotificationsEnabled={feedingNotificationsEnabled} notificationPermission={notificationPermission} gotifyAvailable={gotifyAvailable} gotifyRemindersEnabled={gotifyRemindersEnabled} medicineReminderSettings={medicineReminderSettings} fileInputRef={fileInputRef} setSettingsOpen={setSettingsOpen} setEntries={setEntries} setDiapers={setDiapers} setBabyDob={setBabyDob} setTummyGoalMinutes={setTummyGoalMinutes} setSession={setSession} setUndoState={setUndoState} setFeedingNotificationsEnabled={setFeedingNotificationsEnabled} enableFeedingNotifications={enableFeedingNotifications} setGotifyReminders={setGotifyReminders} setMedicineReminderSettings={setMedicineReminderSettings} showToast={showToast} /> : null}
    </>
  )
}
