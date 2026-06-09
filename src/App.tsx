import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, Entry, MedicineEvent, MedicineKind, Side, View } from './types'
import { calculateAvgGapMinutes, calculateStats, calculateSuggestedSide, calculateTodaySummary, calculateTrend, entryToResumedSession, formatAvgGapShort, formatClockInput, formatMinutesAgo, formatShortTimeRange, medicineLabel } from './domain/trackerDomain'
import { useServerSync } from './sync/useServerSync'
import { usePersistentTrackerState } from './state/usePersistentTrackerState'
import { Timeline } from './components/Timeline'
import { HeroPanel } from './components/HeroPanel'
import { StatsDashboard } from './components/StatsDashboard'
import { TrackerModals } from './components/TrackerModals'
import { AppHeader } from './components/AppHeader'
import { TrackOverview } from './components/TrackOverview'
import { useNotificationSettings } from './notifications/useNotificationSettings'
import { useUndoToast } from './state/useUndoToast'
import { useActiveFeedActions } from './state/useActiveFeedActions'
import { useAuxiliaryEventActions } from './state/useAuxiliaryEventActions'
import './styles.css'

const NOTIFICATION_APP_URL = 'https://feedr.kjw.lol'
const NEXT_FEEDING_REMINDER_OFFSETS_MS = [2 * 60 * 60 * 1000, 3 * 60 * 60 * 1000]
const MEDICINE_REMINDER_MS = 6 * 60 * 60 * 1000
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
  const { syncStatus } = useServerSync({ entries, diapers, medicines, session, theme, setEntries, setDiapers, setMedicines, setSession, setTheme })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { toast, undoState, setToast, setUndoState, showToast, undoToastText, undoLabel, undo } = useUndoToast({ setEntries, setDiapers, setMedicines, setSession })
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date().getTime()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    if (!resumeFocusTick || !session) return
    window.requestAnimationFrame(() => {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const primaryControl = heroRef.current?.querySelector<HTMLButtonElement>('.hero-actions button')
      primaryControl?.focus({ preventScroll: true })
    })
  }, [resumeFocusTick, session])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setBottleOpen(false)
      setManualOpen(false)
      setSettingsOpen(false)
      setSelectedDiapers([])
      setEditingDiaper(null)
      setOpenEntryMenuId(null)
      setConfirmingDeleteEntryId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setSettingsOpen])

  useEffect(() => {
    if (!openEntryMenuId) return
    const onPointerDown = (event: PointerEvent) => {
      const path = event.composedPath()
      if (path.some((target) => target instanceof Element && target.closest('.entry-action-wrap'))) return
      setOpenEntryMenuId(null)
      setConfirmingDeleteEntryId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [openEntryMenuId])


  const { gotifyAvailable, gotifyRemindersEnabled, notificationPermission, setGotifyReminders, enableFeedingNotifications } = useNotificationSettings({ setFeedingNotificationsEnabled, showToast })

  const deleteEntry = (entry: Entry) => {
    if (undoState) window.clearTimeout(undoState.timeoutId)
    setOpenEntryMenuId(null)
    setConfirmingDeleteEntryId(null)
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ entry, timeoutId, kind: 'delete' })
    setToast('Entry deleted')
  }

  const toggleEditingDiaperKind = (kind: DiaperKind) => {
    if (!editingDiaper) return
    const kinds = editingDiaper.kinds.includes(kind) ? editingDiaper.kinds.filter((item) => item !== kind) : [...editingDiaper.kinds, kind]
    setEditingDiaper({ ...editingDiaper, kinds })
  }

  const toggleEditingEntryDiaperKind = (kind: DiaperKind) => {
    if (!editing) return
    const diaperKinds = editing.diaperKinds.includes(kind) ? editing.diaperKinds.filter((item) => item !== kind) : [...editing.diaperKinds, kind]
    setEditing({ ...editing, diaperKinds })
  }

  const resumeEntry = (entry: Entry) => {
    if (session) return showToast('Finish or clear the active feed before resuming another entry')
    if (undoState) window.clearTimeout(undoState.timeoutId)
    const previousSession = session
    const t = new Date().getTime()
    setNow(t)
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    setSession(entryToResumedSession(entry, t))
    setResumeFocusTick((tick) => tick + 1)
    setEditing(null)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ entry, timeoutId, kind: 'resume', previousSession })
    setToast('Session resumed')
  }

  const {
    loggedActiveDiaperKinds,
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

  const medicineReminderDue = (['tylenol', 'motrin'] as MedicineKind[])
    .map((kind) => medicines.find((medicine) => medicine.kind === kind))
    .filter((medicine): medicine is MedicineEvent => Boolean(medicine && now - medicine.at >= MEDICINE_REMINDER_MS))
    .sort((a, b) => a.at - b.at)[0]
  const medicineReminder: { id: string; label: string; recommendedKind: MedicineKind; recommendedLabel: string; at: number } | null = medicineReminderDue
    ? { id: medicineReminderDue.id, label: medicineLabel(medicineReminderDue.kind), recommendedKind: medicineReminderDue.kind, recommendedLabel: medicineLabel(medicineReminderDue.kind), at: medicineReminderDue.at }
    : null
  const showMedicineReminder = Boolean(medicineReminder && dismissedMedicineReminderId !== medicineReminder.id)

  const today = useMemo(() => calculateTodaySummary(entries, diapers, now), [entries, diapers, now])

  const lastFeed = entries[0]
  const minsSinceLast = lastFeed && now ? Math.floor((now - lastFeed.endedAt) / 60000) : null
  const avgGapMinutes = useMemo(() => calculateAvgGapMinutes(entries), [entries])
  const lastFeedMetaText = minsSinceLast === null ? 'No feed history yet' : formatMinutesAgo(minsSinceLast)
  const avgGapShortText = avgGapMinutes ? formatAvgGapShort(avgGapMinutes) : null
  const suggestedSide = useMemo<Side>(() => calculateSuggestedSide(entries, today), [entries, today])
  const nextFeedSideText = suggestedSide[0].toUpperCase()
  const nextFeedWindowText = lastFeed ? formatShortTimeRange(lastFeed.endedAt + 2 * 60 * 60 * 1000, lastFeed.endedAt + 3 * 60 * 60 * 1000) : 'After first feed'

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

  useEffect(() => {
    if (!feedingNotificationsEnabled || notificationPermission !== 'granted' || !lastFeed || typeof Notification === 'undefined') return
    const timers = NEXT_FEEDING_REMINDER_OFFSETS_MS
      .map((offsetMs) => ({ offsetMs, delayMs: lastFeed.endedAt + offsetMs - new Date().getTime() }))
      .filter(({ delayMs }) => delayMs > 0)
      .map(({ offsetMs, delayMs }) => window.setTimeout(() => {
        const hours = Math.round(offsetMs / (60 * 60 * 1000))
        const notification = new Notification('Feeding window reminder', {
          body: `${hours} hours since the last feed. Open Feedr to log or resume.`,
          tag: `next-feeding-${lastFeed.id}-${hours}h`,
          requireInteraction: hours === 3,
        })
        notification.onclick = () => {
          window.open(NOTIFICATION_APP_URL, '_blank', 'noopener,noreferrer')
          notification.close()
        }
      }, delayMs))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [feedingNotificationsEnabled, lastFeed, notificationPermission])
  const trend = useMemo(() => calculateTrend(entries, now), [entries, now])

  const stats = useMemo(() => calculateStats(entries, diapers, now, today, trend.days), [entries, diapers, now, today, trend.days])



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
        loggedActiveDiaperKinds={loggedActiveDiaperKinds}
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
        medicineReminder={medicineReminder}
        showMedicineReminder={showMedicineReminder}
        dismissMedicineReminder={setDismissedMedicineReminderId}
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





