import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, View } from './types'
import { formatClockInput } from './domain/trackerDomain'
import { useServerSync } from './sync/useServerSync'
import { usePersistentTrackerState } from './state/usePersistentTrackerState'
import { Timeline } from './components/Timeline'
import { HeroPanel } from './components/HeroPanel'
import { StatsDashboard } from './components/StatsDashboard'
import { TrackerModals } from './components/TrackerModals'
import { AppHeader } from './components/AppHeader'
import { MedicineReminderBanner } from './components/MedicineReminderBanner'
import { TrackOverview } from './components/TrackOverview'
import { useNotificationSettings } from './notifications/useNotificationSettings'
import { useUndoToast } from './state/useUndoToast'
import { useActiveFeedActions } from './state/useActiveFeedActions'
import { useAuxiliaryEventActions } from './state/useAuxiliaryEventActions'
import { useTimelineEntryActions } from './state/useTimelineEntryActions'
import { useAppUiEffects } from './state/useAppUiEffects'
import { useBrowserFeedNotifications } from './notifications/useBrowserFeedNotifications'
import { useTrackerPageModel } from './state/useTrackerPageModel'
import './styles.css'

function App() {
  const { entries, setEntries, session, setSession, diapers, setDiapers, medicines, setMedicines, theme, setTheme, settingsOpen, setSettingsOpen, feedingNotificationsEnabled, setFeedingNotificationsEnabled } = usePersistentTrackerState()
  const [selectedDiapers, setSelectedDiapers] = useState<DiaperKind[]>([])
  const [dismissedMedicineReminderId, setDismissedMedicineReminderId] = useState<string | null>(null)
  const [view, setView] = useState<View>('track')
  const [bottleOpen, setBottleOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDraft, setManualDraft] = useState({ leftMinutes: '', rightMinutes: '', bottleOunces: '', note: '' })
  const [bottleQuickOz, setBottleQuickOz] = useState(2)
  const [startInputMode, setStartInputMode] = useState<'clock' | 'minutes'>('clock')
  const [startOffsetOpen, setStartOffsetOpen] = useState(false)
  const [startClockText, setStartClockText] = useState(() => formatClockInput(new Date().getTime()))
  const [startMinutesAgo, setStartMinutesAgo] = useState('0')
  const [now, setNow] = useState(() => new Date().getTime())
  const [editing, setEditing] = useState<EditingState>(null)
  const [editingDiaper, setEditingDiaper] = useState<EditingDiaperState>(null)
  const [editingMedicine, setEditingMedicine] = useState<EditingMedicineState>(null)
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(false)
  const [openEntryMenuId, setOpenEntryMenuId] = useState<string | null>(null)
  const [confirmingDeleteEntryId, setConfirmingDeleteEntryId] = useState<string | null>(null)
  const [resumeFocusTick, setResumeFocusTick] = useState(0)
  const heroRef = useRef<HTMLElement | null>(null)
  const processedQuickMedicineRef = useRef(false)
  const { syncStatus } = useServerSync({ entries, diapers, medicines, session, theme, setEntries, setDiapers, setMedicines, setSession, setTheme })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { toast, undoState, setToast, setUndoState, showToast, undoToastText, undoLabel, undo } = useUndoToast({ setEntries, setDiapers, setMedicines, setSession })
  useAppUiEffects({
    setNow,
    resumeFocusTick,
    session,
    heroRef,
    setBottleOpen,
    setManualOpen,
    setSettingsOpen,
    setSelectedDiapers,
    setEditingDiaper,
    openEntryMenuId,
    setOpenEntryMenuId,
    setConfirmingDeleteEntryId,
  })

  const { gotifyAvailable, gotifyRemindersEnabled, notificationPermission, setGotifyReminders, enableFeedingNotifications } = useNotificationSettings({ setFeedingNotificationsEnabled, showToast })

  const { deleteEntry, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, resumeEntry } = useTimelineEntryActions({
    session,
    setNow,
    setSession,
    setEntries,
    editing,
    setEditing,
    editingDiaper,
    setEditingDiaper,
    setOpenEntryMenuId,
    setConfirmingDeleteEntryId,
    setResumeFocusTick,
    undoState,
    setUndoState,
    setToast,
    showToast,
  })

  const {
    availableSelectedDiapers,
    logBottle,
    toggleDiaperSelection,
    logSelectedDiapers,
    deleteDiaper,
    saveDiaperEdit,
    logMedicine,
    saveMedicineEdit,
    startMedicineEdit,
    deleteMedicine,
    saveManualFeed,
  } = useAuxiliaryEventActions({
    now,
    session,
    setSession,
    setEntries,
    setDiapers,
    setMedicines,
    selectedDiapers,
    setSelectedDiapers,
    bottleQuickOz,
    manualDraft,
    setManualDraft,
    setManualOpen,
    setAdditionalOptionsOpen,
    editingDiaper,
    setEditingDiaper,
    editingMedicine,
    setEditingMedicine,
    setDismissedMedicineReminderId,
    setOpenEntryMenuId,
    setConfirmingDeleteEntryId,
    undoState,
    setUndoState,
    showToast,
  })

  useEffect(() => {
    if (processedQuickMedicineRef.current) return
    const params = new URLSearchParams(window.location.search)
    const quickMed = params.get('quickMed')
    if (quickMed !== 'tylenol' && quickMed !== 'motrin') return
    processedQuickMedicineRef.current = true
    logMedicine(quickMed)
    params.delete('quickMed')
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', nextUrl)
  }, [logMedicine])

  const {
    today,
    trend,
    stats,
    lastFeed,
    lastFeedMetaText,
    avgGapShortText,
    suggestedSide,
    nextFeedSideText,
    nextFeedWindowText,
    medicineReminder,
    showMedicineReminder,
  } = useTrackerPageModel({ entries, diapers, medicines, session, now, dismissedMedicineReminderId })

  const { selectedStartMinutesAgo, activeSplit, activeSeconds, activeSide, activeOppositeSide, startSession, switchSide, pause, resume, clearSession, endSession } = useActiveFeedActions({
    now,
    setNow,
    session,
    setSession,
    setEntries,
    selectedDiapers,
    setSelectedDiapers,
    startOffsetOpen,
    startInputMode,
    startClockText,
    startMinutesAgo,
    suggestedSide,
    undoState,
    setUndoState,
    setToast,
    showToast,
    setBottleOpen,
  })

  useBrowserFeedNotifications({ feedingNotificationsEnabled, notificationPermission, lastFeed })

  return (
    <main className="app">
      <AppHeader
        view={view}
        syncStatus={syncStatus}
        theme={theme}
        settingsOpen={settingsOpen}
        setView={setView}
        setTheme={setTheme}
        setSettingsOpen={setSettingsOpen}
      />

      <MedicineReminderBanner
        medicineReminder={medicineReminder}
        showMedicineReminder={showMedicineReminder}
        dismissMedicineReminder={setDismissedMedicineReminderId}
        logMedicine={logMedicine}
      />

      {view === 'track' ? (
      <div className="tracker-view">
      <HeroPanel
        ref={heroRef}
        session={session}
        activeSeconds={activeSeconds}
        activeSplit={activeSplit}
        activeSide={activeSide}
        activeOppositeSide={activeOppositeSide}
        suggestedSide={suggestedSide}
        nextFeedWindowText={nextFeedWindowText}
        nextFeedSideText={nextFeedSideText}
        lastFeedMetaText={lastFeedMetaText}
        avgGapShortText={avgGapShortText}
        hasLastFeed={Boolean(lastFeed)}
        startOffsetOpen={startOffsetOpen}
        startInputMode={startInputMode}
        startClockText={startClockText}
        startMinutesAgo={startMinutesAgo}
        selectedStartMinutesAgo={selectedStartMinutesAgo}
        selectedDiapers={selectedDiapers}
        availableSelectedDiapers={availableSelectedDiapers}
        additionalOptionsOpen={additionalOptionsOpen}
        setStartOffsetOpen={setStartOffsetOpen}
        setStartInputMode={setStartInputMode}
        setStartClockText={setStartClockText}
        setStartMinutesAgo={setStartMinutesAgo}
        setAdditionalOptionsOpen={setAdditionalOptionsOpen}
        setBottleOpen={setBottleOpen}
        setManualOpen={setManualOpen}
        setSession={setSession}
        startSession={startSession}
        switchSide={switchSide}
        pause={pause}
        resume={resume}
        endSession={endSession}
        clearSession={clearSession}
        toggleDiaperSelection={toggleDiaperSelection}
        logSelectedDiapers={logSelectedDiapers}
        logMedicine={logMedicine}
      />

      <TrackOverview
        today={today}
        trend={trend}
      />
      </div>) : (
      <StatsDashboard stats={stats} trend={trend} />
      )}

      <TrackerModals
        bottleOpen={bottleOpen}
        manualOpen={manualOpen}
        settingsOpen={settingsOpen}
        session={session}
        bottleQuickOz={bottleQuickOz}
        manualDraft={manualDraft}
        entries={entries}
        diapers={diapers}
        feedingNotificationsEnabled={feedingNotificationsEnabled}
        notificationPermission={notificationPermission}
        gotifyAvailable={gotifyAvailable}
        gotifyRemindersEnabled={gotifyRemindersEnabled}
        fileInputRef={fileInputRef}
        setBottleOpen={setBottleOpen}
        setManualOpen={setManualOpen}
        setSettingsOpen={setSettingsOpen}
        setBottleQuickOz={setBottleQuickOz}
        setManualDraft={setManualDraft}
        setEntries={setEntries}
        setDiapers={setDiapers}
        setSession={setSession}
        setUndoState={setUndoState}
        setFeedingNotificationsEnabled={setFeedingNotificationsEnabled}
        logBottle={logBottle}
        saveManualFeed={saveManualFeed}
        enableFeedingNotifications={enableFeedingNotifications}
        setGotifyReminders={setGotifyReminders}
        showToast={showToast}
      />

      {view === 'track' ? <Timeline
        entries={entries}
        diapers={diapers}
        medicines={medicines}
        editing={editing}
        editingDiaper={editingDiaper}
        editingMedicine={editingMedicine}
        openEntryMenuId={openEntryMenuId}
        confirmingDeleteEntryId={confirmingDeleteEntryId}
        setEntries={setEntries}
        setEditing={setEditing}
        setEditingDiaper={setEditingDiaper}
        setEditingMedicine={setEditingMedicine}
        setOpenEntryMenuId={setOpenEntryMenuId}
        setConfirmingDeleteEntryId={setConfirmingDeleteEntryId}
        resumeEntry={resumeEntry}
        deleteEntry={deleteEntry}
        deleteDiaper={deleteDiaper}
        deleteMedicine={deleteMedicine}
        startMedicineEdit={startMedicineEdit}
        toggleEditingDiaperKind={toggleEditingDiaperKind}
        toggleEditingEntryDiaperKind={toggleEditingEntryDiaperKind}
        saveDiaperEdit={saveDiaperEdit}
        saveMedicineEdit={saveMedicineEdit}
        showToast={showToast}
      /> : null}

      {(toast || undoState) && <div className="toast"><span>{toast || undoToastText}</span>{undoState && <button aria-label={undoLabel} onClick={undo}><RotateCcw size={15} /> Undo</button>}</div>}
    </main>
  )
}

export default App





