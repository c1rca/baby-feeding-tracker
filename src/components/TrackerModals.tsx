import { useEffect, useRef } from 'react'
import { formatDateInput, formatTimeInput } from '../domain/trackerDomain'
import { BottleModal } from './modals/BottleModal'
import { ManualFeedModal } from './modals/ManualFeedModal'
import { PastEventModal } from './modals/PastEventModal'
import { SettingsModal } from './modals/SettingsModal'
import type { TrackerModalsProps } from './modals/modalTypes'

export function TrackerModals({
  bottleOpen,
  manualOpen,
  pastEventOpen,
  settingsOpen,
  session,
  bottleQuickOz,
  manualDraft,
  pastEventDraft,
  entries,
  diapers,
  medicines,
  tummyTimes,
  pumpEvents,
  pumpSession,
  tummySession,
  growthMeasurements,
  babyDob,
  tummyGoalMinutes,
  feedingNotificationsEnabled,
  browserRemindersEnabled,
  liveSyncEnabled,
  notificationPermission,
  notificationPreferences,
  gotifyAvailable,
  gotifyRemindersEnabled,
  medicineReminderSettings,
  babies = [],
  selectedBabyId = '',
  authUser = null,
  profileName,
  setProfileName,
  theme,
  onLogout,
  fileInputRef,
  setBottleOpen,
  setManualOpen,
  setPastEventOpen,
  setSettingsOpen,
  setBottleQuickOz,
  setManualDraft,
  setPastEventDraft,
  setEntries,
  setDiapers,
  setMedicines,
  setTummyTimes,
  setPumpEvents,
  setPumpSession,
  setTummySession,
  setGrowthMeasurements,
  setBabyDob,
  setTummyGoalMinutes,
  setSession,
  setUndoState,
  setFeedingNotificationsEnabled,
  setBrowserRemindersEnabled,
  setLiveSyncEnabled,
  setNotificationPreferences,
  setTheme,
  logBottle,
  saveManualFeed,
  savePastEvent,
  enableBrowserReminders,
  setGotifyReminders,
  setMedicineReminderSettings,
  onCreateBaby,
  onRenameBaby,
  onArchiveBaby,
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
      {pastEventOpen ? <PastEventModal draft={pastEventDraft} setDraft={setPastEventDraft} onClose={() => setPastEventOpen(false)} onSave={savePastEvent} /> : null}
      {settingsOpen ? <SettingsModal entries={entries} diapers={diapers} medicines={medicines} tummyTimes={tummyTimes} pumpEvents={pumpEvents} pumpSession={pumpSession} tummySession={tummySession} growthMeasurements={growthMeasurements} session={session} babyDob={babyDob} tummyGoalMinutes={tummyGoalMinutes} feedingNotificationsEnabled={feedingNotificationsEnabled} browserRemindersEnabled={browserRemindersEnabled} notificationPermission={notificationPermission} notificationPreferences={notificationPreferences} gotifyAvailable={gotifyAvailable} gotifyRemindersEnabled={gotifyRemindersEnabled} medicineReminderSettings={medicineReminderSettings} babies={babies} selectedBabyId={selectedBabyId} authUser={authUser} profileName={profileName || 'Mom'} setProfileName={setProfileName || (() => undefined)} theme={theme} onLogout={onLogout} fileInputRef={fileInputRef} setSettingsOpen={setSettingsOpen} setEntries={setEntries} setDiapers={setDiapers} setMedicines={setMedicines} setTummyTimes={setTummyTimes} setPumpEvents={setPumpEvents} setPumpSession={setPumpSession} setTummySession={setTummySession} setGrowthMeasurements={setGrowthMeasurements} setBabyDob={setBabyDob} setTummyGoalMinutes={setTummyGoalMinutes} setSession={setSession} setUndoState={setUndoState} setFeedingNotificationsEnabled={setFeedingNotificationsEnabled} setBrowserRemindersEnabled={setBrowserRemindersEnabled} liveSyncEnabled={liveSyncEnabled} setLiveSyncEnabled={setLiveSyncEnabled} setNotificationPreferences={setNotificationPreferences} setTheme={setTheme} enableBrowserReminders={enableBrowserReminders} setGotifyReminders={setGotifyReminders} setMedicineReminderSettings={setMedicineReminderSettings} onCreateBaby={onCreateBaby} onRenameBaby={onRenameBaby} onArchiveBaby={onArchiveBaby} showToast={showToast} /> : null}
    </>
  )
}
