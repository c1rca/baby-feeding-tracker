import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Baby, BarChart3, ClipboardList, Download, Moon, RotateCcw, Settings, Sun, Trash2, Upload, X } from 'lucide-react'
import { formatDuration, sumSideDurations } from './domain/feedingUtils'
import type { DiaperEvent, DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, Entry, FeedType, MedicineEvent, MedicineKind, Side, UndoState, View } from './types'
import { calculateActiveSplit, calculateAvgGapMinutes, calculateStats, calculateSuggestedSide, calculateTodaySummary, calculateTrend, diaperLabel, entryToResumedSession, formatAvgGapShort, formatClockInput, formatMinutesAgo, formatShortTimeRange, makeId, medicineLabel, oppositeSide, parseClockTimeToday } from './domain/trackerDomain'
import { useServerSync } from './sync/useServerSync'
import { usePersistentTrackerState } from './state/usePersistentTrackerState'
import { Timeline } from './components/Timeline'
import { HeroPanel } from './components/HeroPanel'
import { StatsDashboard } from './components/StatsDashboard'
import './styles.css'

const API_NOTIFICATION_SETTINGS = '/api/notification-settings'
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
  const [toast, setToast] = useState('')
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [editing, setEditing] = useState<EditingState>(null)
  const [editingDiaper, setEditingDiaper] = useState<EditingDiaperState>(null)
  const [editingMedicine, setEditingMedicine] = useState<EditingMedicineState>(null)
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(false)
  const [openEntryMenuId, setOpenEntryMenuId] = useState<string | null>(null)
  const [confirmingDeleteEntryId, setConfirmingDeleteEntryId] = useState<string | null>(null)
  const [resumeFocusTick, setResumeFocusTick] = useState(0)
  const heroRef = useRef<HTMLElement | null>(null)
  const { syncStatus } = useServerSync({ entries, diapers, medicines, session, theme, setEntries, setDiapers, setMedicines, setSession, setTheme })
  const [gotifyAvailable, setGotifyAvailable] = useState(false)
  const [gotifyRemindersEnabled, setGotifyRemindersEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (typeof Notification === 'undefined' ? 'denied' : Notification.permission))
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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


  const loadGotifySettings = useCallback(async () => {
    try {
      const response = await fetch(API_NOTIFICATION_SETTINGS)
      if (!response.ok) throw new Error('settings load failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
    } catch {
      setGotifyAvailable(false)
    }
  }, [])

  useEffect(() => {
    window.setTimeout(() => void loadGotifySettings(), 0)
  }, [loadGotifySettings])

  const setGotifyReminders = async (enabled: boolean) => {
    try {
      const response = await fetch(API_NOTIFICATION_SETTINGS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gotifyRemindersEnabled: enabled }),
      })
      if (!response.ok) throw new Error('settings save failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      showToast(data.gotifyRemindersEnabled ? 'Gotify reminders enabled' : 'Gotify reminders disabled')
    } catch {
      showToast('Could not update Gotify reminders')
    }
  }

  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 1800) }

  const enableFeedingNotifications = async () => {
    if (typeof Notification === 'undefined') return showToast('Notifications are not supported in this browser')
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    setNotificationPermission(permission)
    if (permission !== 'granted') {
      setFeedingNotificationsEnabled(false)
      return showToast('Notification permission not granted')
    }
    setFeedingNotificationsEnabled(true)
    showToast('Feeding reminders enabled')
  }

  const selectedStartTime = useMemo(() => {
    const t = now
    if (!startOffsetOpen) return now
    if (startInputMode === 'minutes') {
      const minutes = Math.max(0, Number(startMinutesAgo) || 0)
      return t - Math.round(minutes * 60000)
    }
    return parseClockTimeToday(startClockText, t) ?? t
  }, [now, startClockText, startInputMode, startMinutesAgo, startOffsetOpen])
  const selectedStartMinutesAgo = Math.max(0, Math.round((now - selectedStartTime) / 60000))

  const startSession = (side: Side) => { const t = new Date().getTime(); const startedAt = Math.min(selectedStartTime, t); setNow(t); setSession({ startedAt, activeSide: side, segmentStart: startedAt, segments: [], bottleOunces: 0, note: '', diaperKinds: [] }) }
  const switchSide = (side: Side) => { if (!session || !session.activeSide || !session.segmentStart) return; const t = new Date().getTime(); setSession({ ...session, segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }], activeSide: side, segmentStart: t }) }
  const pause = () => { if (!session || !session.activeSide || !session.segmentStart) return; const t = new Date().getTime(); setSession({ ...session, segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }], activeSide: null, segmentStart: null }) }
  const resume = (side: Side) => { if (!session) return; const t = new Date().getTime(); setNow(t); setSession({ ...session, activeSide: side, segmentStart: t }) }

  const clearSession = () => {
    if (!session) return showToast('No active feed to clear')
    if (undoState) window.clearTimeout(undoState.timeoutId)
    const clearedSession = session
    setSession(null)
    setBottleOpen(false)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ session: clearedSession, timeoutId, kind: 'clear-session' })
    setToast('Active feed cleared')
  }

  const endSession = () => {
    if (!session) return showToast('No active feed to end')
    const t = new Date().getTime()
    const finished = [...session.segments]
    if (session.activeSide && session.segmentStart) finished.push({ side: session.activeSide, startedAt: session.segmentStart, endedAt: t })
    const { left, right } = sumSideDurations(finished)
    const bottle = session.bottleOunces > 0 ? session.bottleOunces : null
    const type: FeedType = bottle && left + right > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
    const selectedKinds = selectedDiapers.filter((kind) => !session.diaperKinds.includes(kind))
    const diaperKinds = [...session.diaperKinds, ...selectedKinds]
    setEntries((prev) => [{ id: makeId(), type, startedAt: session.startedAt, endedAt: t, leftSeconds: left, rightSeconds: right, bottleOunces: bottle, note: session.note.trim() || '', diaperKinds }, ...prev])
    setSelectedDiapers((prev) => prev.filter((kind) => !selectedKinds.includes(kind)))
    setSession(null)
    showToast('Feed saved')
  }

  const deleteEntry = (entry: Entry) => {
    if (undoState) window.clearTimeout(undoState.timeoutId)
    setOpenEntryMenuId(null)
    setConfirmingDeleteEntryId(null)
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ entry, timeoutId, kind: 'delete' })
    setToast('Entry deleted')
  }

  const deleteDiaper = (diaper: DiaperEvent) => {
    if (undoState) window.clearTimeout(undoState.timeoutId)
    setOpenEntryMenuId(null)
    setConfirmingDeleteEntryId(null)
    setEditingDiaper(null)
    setDiapers((prev) => prev.filter((item) => item.id !== diaper.id))
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ diaper, timeoutId, kind: 'diaper-delete' })
    setToast('Diaper deleted')
  }

  const saveDiaperEdit = (diaper: DiaperEvent) => {
    if (!editingDiaper || editingDiaper.kinds.length === 0) return showToast('Select wet, stool, or both')
    setDiapers((prev) => prev.map((item) => item.id === diaper.id ? { ...item, kind: undefined, kinds: editingDiaper.kinds } : item).sort((a, b) => b.at - a.at))
    setEditingDiaper(null)
    showToast('Diaper updated')
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

  const logBottle = (oz?: number) => {
    const amount = oz ?? bottleQuickOz
    if (session) {
      setSession({ ...session, bottleOunces: +(session.bottleOunces + amount).toFixed(1) })
      showToast('Bottle added to active feed')
      return
    }
    const t = now || new Date().getTime()
    setEntries((prev) => [{ id: makeId(), type: 'bottle', startedAt: t, endedAt: t, leftSeconds: 0, rightSeconds: 0, bottleOunces: amount, note: '' }, ...prev])
    showToast('Bottle feed saved')
  }


  const loggedActiveDiaperKinds = useMemo(() => new Set<DiaperKind>(session?.diaperKinds ?? []), [session])

  const availableSelectedDiapers = selectedDiapers.filter((kind) => !session || !loggedActiveDiaperKinds.has(kind))

  const toggleDiaperSelection = (kind: DiaperKind) => {
    if (session && loggedActiveDiaperKinds.has(kind)) return
    setSelectedDiapers((prev) => prev.includes(kind) ? prev.filter((item) => item !== kind) : [...prev, kind])
  }

  const logSelectedDiapers = () => {
    const kinds = availableSelectedDiapers
    if (kinds.length === 0) return showToast(session ? 'Select an unlogged diaper' : 'Select wet, stool, or both')
    const label = kinds.map(diaperLabel).join(' + ')
    if (session) {
      setSession({ ...session, diaperKinds: [...session.diaperKinds, ...kinds] })
      setSelectedDiapers((prev) => prev.filter((kind) => !kinds.includes(kind)))
      showToast(`${label} added to this feed`)
      return
    }
    const t = new Date().getTime()
    const diaper: DiaperEvent = { id: makeId(), kinds, at: t, context: 'standalone' }
    setDiapers((prev) => [diaper, ...prev].sort((a, b) => b.at - a.at))
    setSelectedDiapers((prev) => prev.filter((kind) => !kinds.includes(kind)))
    if (undoState) window.clearTimeout(undoState.timeoutId)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ diaper, timeoutId, kind: 'diaper-log' })
    showToast(`${label} diaper logged`)
  }

  const medicineReminderDue = (['tylenol', 'motrin'] as MedicineKind[])
    .map((kind) => medicines.find((medicine) => medicine.kind === kind))
    .filter((medicine): medicine is MedicineEvent => Boolean(medicine && now - medicine.at >= MEDICINE_REMINDER_MS))
    .sort((a, b) => a.at - b.at)[0]
  const medicineReminder: { id: string; label: string; recommendedKind: MedicineKind; recommendedLabel: string; at: number } | null = medicineReminderDue
    ? { id: medicineReminderDue.id, label: medicineLabel(medicineReminderDue.kind), recommendedKind: medicineReminderDue.kind, recommendedLabel: medicineLabel(medicineReminderDue.kind), at: medicineReminderDue.at }
    : null
  const showMedicineReminder = Boolean(medicineReminder && dismissedMedicineReminderId !== medicineReminder.id)

  const logMedicine = (kind: MedicineKind) => {
    const t = new Date().getTime()
    const medicine: MedicineEvent = { id: makeId(), kind, at: t }
    setMedicines((prev) => [medicine, ...prev].sort((a, b) => b.at - a.at))
    setDismissedMedicineReminderId(null)
    setAdditionalOptionsOpen(false)
    if (undoState) window.clearTimeout(undoState.timeoutId)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ medicine, timeoutId, kind: 'medicine-log' })
    showToast(`${medicineLabel(kind)} logged`)
  }

  const saveMedicineEdit = (medicine: MedicineEvent) => {
    if (!editingMedicine) return
    const nextAt = parseClockTimeToday(editingMedicine.time, editingMedicine.originalAt)
    if (nextAt === null) return showToast('Enter a valid medicine time')
    setMedicines((prev) => prev.map((item) => item.id === medicine.id ? { ...item, kind: editingMedicine.kind, at: nextAt } : item).sort((a, b) => b.at - a.at))
    setDismissedMedicineReminderId(null)
    setEditingMedicine(null)
    showToast('Medicine updated')
  }

  const startMedicineEdit = (medicine: MedicineEvent) => {
    setEditingMedicine({ id: medicine.id, kind: medicine.kind, time: formatClockInput(medicine.at), originalAt: medicine.at })
    setOpenEntryMenuId(null)
  }

  const deleteMedicine = (medicine: MedicineEvent) => {
    setMedicines((prev) => prev.filter((item) => item.id !== medicine.id))
    setEditingMedicine(null)
    setOpenEntryMenuId(null)
    if (undoState) window.clearTimeout(undoState.timeoutId)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ medicine, timeoutId, kind: 'medicine-delete' })
    showToast('Medicine deleted')
  }

  const saveManualFeed = () => {
    const leftSeconds = Math.max(0, Math.round((Number(manualDraft.leftMinutes) || 0) * 60))
    const rightSeconds = Math.max(0, Math.round((Number(manualDraft.rightMinutes) || 0) * 60))
    const bottle = Number(manualDraft.bottleOunces) > 0 ? Number(manualDraft.bottleOunces) : null
    if (leftSeconds + rightSeconds === 0 && !bottle) return showToast('Add nursing time or bottle ounces')
    const durationMs = Math.max(0, leftSeconds + rightSeconds) * 1000
    const endedAt = new Date().getTime()
    const type: FeedType = bottle && leftSeconds + rightSeconds > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
    setEntries((prev) => [{ id: makeId(), type, startedAt: endedAt - durationMs, endedAt, leftSeconds, rightSeconds, bottleOunces: bottle, note: manualDraft.note.trim() }, ...prev])
    setManualDraft({ leftMinutes: '', rightMinutes: '', bottleOunces: '', note: '' })
    setManualOpen(false)
    showToast('Missed feed saved')
  }

  const activeSplit = useMemo(() => calculateActiveSplit(session, now), [session, now])

  const activeSeconds = activeSplit.left + activeSplit.right

  const today = useMemo(() => calculateTodaySummary(entries, diapers, now), [entries, diapers, now])

  const lastFeed = entries[0]
  const minsSinceLast = lastFeed && now ? Math.floor((now - lastFeed.endedAt) / 60000) : null
  const avgGapMinutes = useMemo(() => calculateAvgGapMinutes(entries), [entries])
  const lastFeedMetaText = minsSinceLast === null ? 'No feed history yet' : formatMinutesAgo(minsSinceLast)
  const avgGapShortText = avgGapMinutes ? formatAvgGapShort(avgGapMinutes) : null
  const suggestedSide = useMemo<Side>(() => calculateSuggestedSide(entries, today), [entries, today])
  const nextFeedSideText = suggestedSide[0].toUpperCase()
  const nextFeedWindowText = lastFeed ? formatShortTimeRange(lastFeed.endedAt + 2 * 60 * 60 * 1000, lastFeed.endedAt + 3 * 60 * 60 * 1000) : 'After first feed'

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
  const activeSide = session?.activeSide
  const activeOppositeSide = activeSide ? oppositeSide(activeSide) : suggestedSide

  const trend = useMemo(() => calculateTrend(entries, now), [entries, now])

  const stats = useMemo(() => calculateStats(entries, diapers, now, today, trend.days), [entries, diapers, now, today, trend.days])

  const undoToastText = undoState?.kind === 'resume' ? 'Session resumed' : undoState?.kind === 'clear-session' ? 'Active feed cleared' : undoState?.kind === 'diaper-log' ? 'Diaper logged' : undoState?.kind === 'diaper-delete' ? 'Diaper deleted' : undoState?.kind === 'medicine-log' ? 'Medicine logged' : undoState?.kind === 'medicine-delete' ? 'Medicine deleted' : 'Entry deleted'
  const undoLabel = undoState?.kind === 'resume' ? 'Undo resume' : undoState?.kind === 'clear-session' ? 'Undo clear active feed' : undoState?.kind === 'diaper-log' ? 'Undo diaper log' : undoState?.kind === 'diaper-delete' ? 'Undo diaper delete' : undoState?.kind === 'medicine-log' ? 'Undo medicine log' : undoState?.kind === 'medicine-delete' ? 'Undo medicine delete' : 'Undo delete'

  const undo = () => {
    if (!undoState) return
    window.clearTimeout(undoState.timeoutId)
    if (undoState.kind === 'clear-session') {
      setSession(undoState.session)
      showToast('Active feed restored')
    } else if (undoState.kind === 'diaper-log') {
      setDiapers((prev) => prev.filter((diaper) => diaper.id !== undoState.diaper.id))
      showToast('Diaper log undone')
    } else if (undoState.kind === 'diaper-delete') {
      setDiapers((prev) => [undoState.diaper, ...prev].sort((a, b) => b.at - a.at))
      showToast('Diaper delete undone')
    } else if (undoState.kind === 'medicine-log') {
      setMedicines((prev) => prev.filter((medicine) => medicine.id !== undoState.medicine.id))
      showToast('Medicine log undone')
    } else if (undoState.kind === 'medicine-delete') {
      setMedicines((prev) => [undoState.medicine, ...prev].sort((a, b) => b.at - a.at))
      showToast('Medicine delete undone')
    } else if ('entry' in undoState) {
      setEntries((prev) => [undoState.entry, ...prev].sort((a, b) => b.endedAt - a.endedAt))
      if (undoState.kind === 'resume') setSession(undoState.previousSession ?? null)
      showToast(undoState.kind === 'resume' ? 'Resume undone' : 'Deletion undone')
    }
    setUndoState(null)
  }

  return (
    <main className="app">
      <header className="top">
        <h1><Baby size={20} /> Baby Feeding Tracker</h1>
        <div className="top-actions">
          <button className={`icon-plain view-icon-toggle ${view === 'stats' ? 'active' : ''}`} aria-label={view === 'stats' ? 'Show tracker' : 'Show stats'} title={view === 'stats' ? 'Show tracker' : 'Show stats'} onClick={() => setView((current) => current === 'stats' ? 'track' : 'stats')}>
            {view === 'stats' ? <ClipboardList size={18} /> : <BarChart3 size={18} />}
          </button>
          {syncStatus !== 'synced' && (
            <span className={`sync-pill sync-${syncStatus}`}>{syncStatus === 'syncing' ? 'Syncing…' : 'Offline changes saved'}</span>
          )}
          <button className="icon-plain" aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button className="icon-plain" aria-label={settingsOpen ? 'Hide settings' : 'Show settings'} onClick={() => setSettingsOpen((v) => !v)}>
            <Settings size={17} />
          </button>
        </div>
      </header>

      {view === 'track' ? (
      <div className="tracker-view">
      {showMedicineReminder && medicineReminder ? (
        <div className="medicine-reminder-banner" role="alert">
          <div><strong>Medicine reminder</strong><span>Take {medicineReminder.recommendedLabel}. Last dose was {medicineReminder.label} 6+ hours ago.</span></div>
          <button type="button" className="icon-plain" aria-label="Dismiss medicine reminder" onClick={() => setDismissedMedicineReminderId(medicineReminder.id)}><X size={16} /></button>
        </div>
      ) : null}
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

      <section className="grid">
        <div className="card stat"><h3>Feeds today</h3><p>{today.count}</p></div>
        <div className="card stat"><h3>Nursing</h3><p>{formatDuration(today.nursing)}</p></div>
        <div className="card stat"><h3>Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div>
        <div className="card stat"><h3>L / R split</h3><p>{formatDuration(today.left)} / {formatDuration(today.right)}</p></div>
        <div className="card stat diaper-stat"><h3>Diapers today</h3><p>{today.wet} wet · {today.stool} stool</p></div>
      </section>

      <section className="card">
        <h2>7-Day Trend</h2>
        <div className="trend">{trend.days.map((d) => <div key={d.label} className="trend-col"><div className="trend-bar" style={{ height: `${(d.count / trend.max) * 60 + 8}px` }} /><span>{d.label}</span><small>{d.count}</small></div>)}</div>
      </section>
      </div>) : (
      <StatsDashboard stats={stats} trend={trend} />
      )}

      {bottleOpen ? (
        <div className="modal-backdrop" onClick={() => setBottleOpen(false)}>
          <section className="card bottle-card modal-card" role="dialog" aria-modal="true" aria-label={session ? 'Add bottle to active feed' : 'Quick bottle log'} onClick={(e) => e.stopPropagation()}>
            <div className="hero-top"><h2>{session ? 'Add Bottle to Active Feed' : 'Quick Bottle Log'}</h2><span className="pill">One tap</span></div>
            <div className="preset-grid">{[2, 2.5, 3, 3.5, 4].map((oz) => <button key={oz} className="preset-btn" onClick={() => { logBottle(oz); setBottleOpen(false) }}>{oz.toFixed(1)} oz</button>)}</div>
            <div className="bottle-custom-row">
              <button onClick={() => setBottleQuickOz((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}>-</button>
              <strong className="bottle-amount">{bottleQuickOz.toFixed(1)} oz</strong>
              <button onClick={() => setBottleQuickOz((v) => +(v + 0.5).toFixed(1))}>+</button>
              <button className="primary" aria-label="Log bottle" onClick={() => { logBottle(); setBottleOpen(false) }}><Baby size={16} /> Log</button>
            </div>
          </section>
        </div>
      ) : null}

      {manualOpen ? (
        <div className="modal-backdrop" onClick={() => setManualOpen(false)}>
          <section className="card modal-card manual-card" role="dialog" aria-modal="true" aria-label="Add missed feed" onClick={(e) => e.stopPropagation()}>
            <div className="hero-top"><h2>Add Missed Feed</h2><span className="pill">Manual</span></div>
            <div className="manual-grid">
              <label>Manual left minutes<input inputMode="decimal" value={manualDraft.leftMinutes} onChange={(e) => setManualDraft({ ...manualDraft, leftMinutes: e.target.value })} placeholder="0" /></label>
              <label>Manual right minutes<input inputMode="decimal" value={manualDraft.rightMinutes} onChange={(e) => setManualDraft({ ...manualDraft, rightMinutes: e.target.value })} placeholder="0" /></label>
              <label>Manual bottle ounces<input inputMode="decimal" value={manualDraft.bottleOunces} onChange={(e) => setManualDraft({ ...manualDraft, bottleOunces: e.target.value })} placeholder="0.0" /></label>
              <label>Manual note<input value={manualDraft.note} onChange={(e) => setManualDraft({ ...manualDraft, note: e.target.value })} placeholder="optional" /></label>
            </div>
            <div className="row"><button className="primary" onClick={saveManualFeed}>Save missed feed</button><button onClick={() => setManualOpen(false)}>Cancel</button></div>
          </section>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <section className="card settings modal-card" role="dialog" aria-modal="true" aria-label="Settings and data" onClick={(e) => e.stopPropagation()}>
            <h2>Settings & Data</h2>
            <div className="notification-setting">
              <div>
                <strong>Next feeding reminders</strong>
                <p className="muted">Browser/mobile notifications at 2 and 3 hours after each feed. Opens Feedr.</p>
                <small>Permission: {notificationPermission}</small>
              </div>
              {feedingNotificationsEnabled && notificationPermission === 'granted' ? <button type="button" onClick={() => { setFeedingNotificationsEnabled(false); showToast('Feeding reminders disabled') }}>Turn off</button> : <button type="button" className="primary" onClick={enableFeedingNotifications}>Enable reminders</button>}
            </div>
            <div className="notification-setting">
              <div>
                <strong>Gotify reminders</strong>
                <p className="muted">Server-side reminders that still work when this page is closed.</p>
                <small>Status: {gotifyAvailable ? (gotifyRemindersEnabled ? 'on' : 'off') : 'not configured'}</small>
              </div>
              <button type="button" className={gotifyRemindersEnabled ? '' : 'primary'} disabled={!gotifyAvailable} onClick={() => void setGotifyReminders(!gotifyRemindersEnabled)}>{gotifyRemindersEnabled ? 'Turn off' : 'Turn on'}</button>
            </div>
            <div className="row"><button aria-label="Export JSON" onClick={() => { const payload = { version: 1, exportedAt: new Date().toISOString(), entries, diapers }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `feeding-tracker-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); showToast('Data exported') }}><Download size={16} /> Export JSON</button><button aria-label="Import JSON" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import JSON</button><button className="danger" onClick={() => { if (!window.confirm('Clear all feeding data? Export a backup first if needed.')) return; setEntries([]); setDiapers([]); setSession(null); setUndoState(null); showToast('All data cleared') }}><Trash2 size={16} /> Clear all data</button></div>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const text = await file.text(); try { const parsed = JSON.parse(text) as { entries?: Entry[]; diapers?: DiaperEvent[] }; if (!parsed.entries) throw new Error('Invalid data'); setEntries(parsed.entries.sort((a, b) => b.endedAt - a.endedAt)); if (Array.isArray(parsed.diapers)) setDiapers(parsed.diapers.sort((a, b) => b.at - a.at)); showToast('Data imported') } catch { showToast('Import failed: invalid file') } finally { event.target.value = '' } }} />
          </section>
        </div>
      ) : null}

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
