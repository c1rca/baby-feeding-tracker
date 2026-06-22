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
  feedingNotificationsEnabled,
  notificationPermission,
  gotifyAvailable,
  gotifyRemindersEnabled,
  fileInputRef,
  setBottleOpen,
  setManualOpen,
  setSettingsOpen,
  setBottleQuickOz,
  setManualDraft,
  setEntries,
  setDiapers,
  setBabyDob,
  setSession,
  setUndoState,
  setFeedingNotificationsEnabled,
  logBottle,
  saveManualFeed,
  enableFeedingNotifications,
  setGotifyReminders,
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
      {settingsOpen ? <SettingsModal entries={entries} diapers={diapers} babyDob={babyDob} feedingNotificationsEnabled={feedingNotificationsEnabled} notificationPermission={notificationPermission} gotifyAvailable={gotifyAvailable} gotifyRemindersEnabled={gotifyRemindersEnabled} fileInputRef={fileInputRef} setSettingsOpen={setSettingsOpen} setEntries={setEntries} setDiapers={setDiapers} setBabyDob={setBabyDob} setSession={setSession} setUndoState={setUndoState} setFeedingNotificationsEnabled={setFeedingNotificationsEnabled} enableFeedingNotifications={enableFeedingNotifications} setGotifyReminders={setGotifyReminders} showToast={showToast} /> : null}
    </>
  )
}
