import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Activity, Baby, BarChart3, CalendarDays, CirclePause, ClipboardList, Clock3, Download, Droplets, HeartPulse, MoreHorizontal, Moon, Pencil, Pill, RotateCcw, Save, Settings, Sparkles, Sun, Target, Trash2, Trophy, Upload, Waves, X, XCircle } from 'lucide-react'
import { formatDuration, sumSideDurations, type SideSegment } from './domain/feedingUtils'
import './styles.css'

type Side = 'left' | 'right'
type FeedType = 'breast' | 'bottle' | 'mixed'
type Segment = SideSegment
type Entry = {
  id: string
  type: FeedType
  startedAt: number
  endedAt: number
  leftSeconds: number
  rightSeconds: number
  bottleOunces: number | null
  note?: string
  diaperKinds?: DiaperKind[]
}
type DiaperKind = 'wet' | 'stool'
type MedicineKind = 'tylenol' | 'motrin'
type DiaperEvent = { id: string; kind?: DiaperKind; kinds?: DiaperKind[]; at: number; context: 'standalone' | 'feed'; feedStartedAt?: number }
type MedicineEvent = { id: string; kind: MedicineKind; at: number }
type Session = { startedAt: number; activeSide: Side | null; segmentStart: number | null; segments: Segment[]; bottleOunces: number; note: string; diaperKinds: DiaperKind[] }
type LegacySession = Omit<Session, 'note' | 'bottleOunces' | 'diaperKinds'> & { note?: string; bottleOunces?: number; diaperKinds?: DiaperKind[] }
type UndoState =
  | { entry: Entry; timeoutId: number; kind: 'delete' | 'resume'; previousSession?: Session | null }
  | { diaper: DiaperEvent; timeoutId: number; kind: 'diaper-log' | 'diaper-delete' }
  | { medicine: MedicineEvent; timeoutId: number; kind: 'medicine-log' | 'medicine-delete' }
  | { session: Session; timeoutId: number; kind: 'clear-session' }
type EditingState = { id: string; leftMinutes: string; rightMinutes: string; bottleOunces: string; note: string; diaperKinds: DiaperKind[] } | null
type EditingDiaperState = { id: string; kinds: DiaperKind[] } | null
type EditingMedicineState = { id: string; kind: MedicineKind; time: string; originalAt: number } | null
type Theme = 'light' | 'dark'
type View = 'track' | 'stats'

const KEY_ENTRIES = 'baby-feeding-tracker:v1:entries'
const KEY_SESSION = 'baby-feeding-tracker:v1:session'
const KEY_THEME = 'baby-feeding-tracker:v1:theme'
const KEY_SETTINGS_OPEN = 'baby-feeding-tracker:v1:settings-open'
const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'
const KEY_FEEDING_NOTIFICATIONS = 'baby-feeding-tracker:v1:feeding-notifications'
const KEY_DIAPERS = 'baby-feeding-tracker:v1:diapers'
const KEY_MEDICINES = 'baby-feeding-tracker:v1:medicines'
const API_STATE = '/api/state'
const API_NOTIFICATION_SETTINGS = '/api/notification-settings'
const NOTIFICATION_APP_URL = 'https://feedr.kjw.lol'
const NEXT_FEEDING_REMINDER_OFFSETS_MS = [2 * 60 * 60 * 1000, 3 * 60 * 60 * 1000]
const MEDICINE_REMINDER_MS = 6 * 60 * 60 * 1000
const THEME_COOKIE = 'baby_feeding_theme'

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const formatShortTimeRange = (start: number, end: number) => {
  const startText = formatTime(start)
  const endText = formatTime(end)
  const startParts = startText.match(/^(.*)\s([AP]M)$/i)
  const endParts = endText.match(/^(.*)\s([AP]M)$/i)
  if (startParts && endParts && startParts[2] === endParts[2]) return `${startParts[1]}–${endParts[1]} ${endParts[2]}`
  return `${startText}–${endText}`
}
const sideLabel = (side: Side) => (side === 'left' ? 'Left' : 'Right')
const diaperLabel = (kind: DiaperKind) => (kind === 'wet' ? 'Wet' : 'Stool')
const diaperKinds = (event: DiaperEvent): DiaperKind[] => event.kinds?.length ? event.kinds : event.kind ? [event.kind] : []
const diaperEventLabel = (event: DiaperEvent) => diaperKinds(event).map(diaperLabel).join(' + ')
const medicineLabel = (kind: MedicineKind) => (kind === 'tylenol' ? 'Tylenol' : 'Motrin')
const entryDiaperKinds = (entry: Entry): DiaperKind[] => entry.diaperKinds ?? []
const diaperKindsLabel = (kinds: DiaperKind[]) => kinds.map(diaperLabel).join(' + ')
const timelineFeedLabel = (entry: Entry) => {
  if (entry.type !== 'breast') return entry.type
  if (entry.leftSeconds > 0 && entry.rightSeconds === 0) return 'L'
  if (entry.rightSeconds > 0 && entry.leftSeconds === 0) return 'R'
  if (entry.leftSeconds > 0 && entry.rightSeconds > 0) return 'L/R'
  return 'Breast'
}
const oppositeSide = (side: Side): Side => (side === 'left' ? 'right' : 'left')
const makeId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `feed-${new Date().getTime()}-${Math.random().toString(36).slice(2, 10)}`)

const formatClockInput = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const parseClockTimeToday = (value: string, referenceTime: number) => {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, '')
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    hours = hours % 12 + (meridiem === 'pm' ? 12 : 0)
  } else if (hours > 23) {
    return null
  }

  const parsed = new Date(referenceTime)
  parsed.setHours(hours, minutes, 0, 0)
  if (parsed.getTime() > referenceTime) parsed.setDate(parsed.getDate() - 1)
  return parsed.getTime()
}

const normalizeSession = (raw: LegacySession | Session | null | undefined): Session | null => {
  if (!raw) return null
  return {
    ...raw,
    bottleOunces: typeof raw.bottleOunces === 'number' ? raw.bottleOunces : 0,
    note: typeof raw.note === 'string' ? raw.note : '',
    diaperKinds: Array.isArray(raw.diaperKinds) ? raw.diaperKinds.filter((kind): kind is DiaperKind => kind === 'wet' || kind === 'stool') : [],
  }
}

const entryResumeSide = (entry: Entry): Side => {
  if (entry.rightSeconds > 0) return 'right'
  if (entry.leftSeconds > 0) return 'left'
  return 'left'
}

const entryToResumedSession = (entry: Entry, resumeAt: number): Session => {
  const segments: Segment[] = []
  let cursor = entry.startedAt

  if (entry.leftSeconds > 0) {
    const endedAt = cursor + entry.leftSeconds * 1000
    segments.push({ side: 'left', startedAt: cursor, endedAt })
    cursor = endedAt
  }

  if (entry.rightSeconds > 0) {
    const endedAt = cursor + entry.rightSeconds * 1000
    segments.push({ side: 'right', startedAt: cursor, endedAt })
  }

  return {
    startedAt: entry.startedAt,
    activeSide: entryResumeSide(entry),
    segmentStart: resumeAt,
    segments,
    bottleOunces: entry.bottleOunces ?? 0,
    note: entry.note ?? '',
    diaperKinds: entryDiaperKinds(entry),
  }
}

const getCookieTheme = (): Theme | null => {
  const match = document.cookie.match(/(?:^|; )baby_feeding_theme=([^;]+)/)
  if (!match) return null
  const value = decodeURIComponent(match[1])
  return value === 'dark' || value === 'light' ? value : null
}

function App() {
  const [entries, setEntries] = useState<Entry[]>(() => {
    try { const saved = localStorage.getItem(KEY_ENTRIES); const parsed = saved ? (JSON.parse(saved) as Entry[]) : []; return parsed.sort((a, b) => b.endedAt - a.endedAt) } catch { return [] }
  })
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const saved = localStorage.getItem(KEY_SESSION)
      return saved ? normalizeSession(JSON.parse(saved) as LegacySession) : null
    } catch {
      return null
    }
  })
  const [diapers, setDiapers] = useState<DiaperEvent[]>(() => {
    try { const saved = localStorage.getItem(KEY_DIAPERS); const parsed = saved ? (JSON.parse(saved) as DiaperEvent[]) : []; return parsed.sort((a, b) => b.at - a.at) } catch { return [] }
  })
  const [selectedDiapers, setSelectedDiapers] = useState<DiaperKind[]>([])
  const [medicines, setMedicines] = useState<MedicineEvent[]>(() => {
    try { const saved = localStorage.getItem(KEY_MEDICINES); const parsed = saved ? (JSON.parse(saved) as MedicineEvent[]) : []; return parsed.sort((a, b) => b.at - a.at) } catch { return [] }
  })
  const [dismissedMedicineReminderId, setDismissedMedicineReminderId] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(() => getCookieTheme() || (localStorage.getItem(KEY_THEME) as Theme) || 'light')
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline'>(() => (localStorage.getItem(KEY_PENDING_SYNC) === '1' ? 'offline' : 'synced'))
  const [feedingNotificationsEnabled, setFeedingNotificationsEnabled] = useState(() => localStorage.getItem(KEY_FEEDING_NOTIFICATIONS) === '1')
  const [gotifyAvailable, setGotifyAvailable] = useState(false)
  const [gotifyRemindersEnabled, setGotifyRemindersEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (typeof Notification === 'undefined' ? 'denied' : Notification.permission))
  const [hasHydrated, setHasHydrated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const latestPayloadRef = useRef<{ entries: Entry[]; diapers: DiaperEvent[]; medicines: MedicineEvent[]; session: Session | null; theme: Theme }>({ entries, diapers, medicines, session, theme })
  const serverUpdatedAtRef = useRef<string | null>(null)

  useEffect(() => { latestPayloadRef.current = { entries, diapers, medicines, session, theme } }, [entries, diapers, medicines, session, theme])
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date().getTime()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    if (!resumeFocusTick || !session) return
    window.requestAnimationFrame(() => {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const primaryControl = heroRef.current?.querySelector<HTMLButtonElement>('.hero-actions button')
      primaryControl?.focus({ preventScroll: true })
    })
  }, [resumeFocusTick, session])
  useEffect(() => localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries)), [entries])
  useEffect(() => localStorage.setItem(KEY_DIAPERS, JSON.stringify(diapers)), [diapers])
  useEffect(() => localStorage.setItem(KEY_MEDICINES, JSON.stringify(medicines)), [medicines])
  useEffect(() => localStorage.setItem(KEY_SESSION, JSON.stringify(session)), [session])
  useEffect(() => {
    localStorage.setItem(KEY_THEME, theme)
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => localStorage.setItem(KEY_SETTINGS_OPEN, settingsOpen ? '1' : '0'), [settingsOpen])
  useEffect(() => localStorage.setItem(KEY_FEEDING_NOTIFICATIONS, feedingNotificationsEnabled ? '1' : '0'), [feedingNotificationsEnabled])
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
  }, [])

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

  const syncToApi = useCallback(async (nextEntries?: Entry[], nextSession?: Session | null, nextTheme?: Theme, nextDiapers?: DiaperEvent[], nextMedicines?: MedicineEvent[]) => {
    const payload = latestPayloadRef.current
    const entriesToSync = nextEntries ?? payload.entries
    const diapersToSync = nextDiapers ?? payload.diapers
    const medicinesToSync = nextMedicines ?? payload.medicines
    const sessionToSync = nextSession ?? payload.session
    const themeToSync = nextTheme ?? payload.theme
    setSyncStatus('syncing')
    try {
      const response = await fetch(API_STATE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entriesToSync, diapers: diapersToSync, medicines: medicinesToSync, session: sessionToSync, theme: themeToSync, updatedAt: serverUpdatedAtRef.current }),
      })
      if (!response.ok) throw new Error('sync failed')
      const data = (await response.json()) as { updatedAt?: string }
      if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
      localStorage.removeItem(KEY_PENDING_SYNC)
      setSyncStatus('synced')
    } catch {
      localStorage.setItem(KEY_PENDING_SYNC, '1')
      setSyncStatus('offline')
    }
  }, [])

  useEffect(() => {
    window.setTimeout(() => void loadGotifySettings(), 0)
  }, [loadGotifySettings])

  useEffect(() => {
    const loadFromApi = async () => {
      if (localStorage.getItem(KEY_PENDING_SYNC) === '1') {
        setHasHydrated(true)
        await syncToApi()
        return
      }
      try {
        const response = await fetch(API_STATE)
        if (!response.ok) throw new Error('load failed')
        const data = (await response.json()) as { entries?: Entry[]; diapers?: DiaperEvent[]; medicines?: MedicineEvent[]; session?: LegacySession | null; theme?: Theme; updatedAt?: string }
        if (Array.isArray(data.entries)) setEntries(data.entries.sort((a, b) => b.endedAt - a.endedAt))
        if (Array.isArray(data.diapers)) setDiapers(data.diapers.sort((a, b) => b.at - a.at))
        if (Array.isArray(data.medicines)) setMedicines(data.medicines.sort((a, b) => b.at - a.at))
        if (data.session !== undefined) setSession(normalizeSession(data.session))
        if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme)
        if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
        setSyncStatus('synced')
      } catch {
        setSyncStatus('offline')
      } finally {
        setHasHydrated(true)
      }
    }

    void loadFromApi()
  }, [syncToApi])

  useEffect(() => {
    if (!hasHydrated) return
    localStorage.setItem(KEY_PENDING_SYNC, '1')
    window.setTimeout(() => void syncToApi(), 0)
  }, [entries, diapers, medicines, session, theme, hasHydrated, syncToApi])

  useEffect(() => {
    const retrySync = () => {
      if (localStorage.getItem(KEY_PENDING_SYNC) === '1') void syncToApi()
    }
    window.addEventListener('online', retrySync)
    window.addEventListener('focus', retrySync)
    return () => {
      window.removeEventListener('online', retrySync)
      window.removeEventListener('focus', retrySync)
    }
  }, [syncToApi])

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

  const activeSplit = useMemo(() => {
    if (!session) return { left: 0, right: 0 }
    const draft = [...session.segments]
    if (session.activeSide && session.segmentStart) draft.push({ side: session.activeSide, startedAt: session.segmentStart, endedAt: now })
    return sumSideDurations(draft)
  }, [session, now])

  const activeSeconds = activeSplit.left + activeSplit.right

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const list = entries.filter((e) => e.endedAt >= start.getTime())
    return {
      count: list.length,
      nursing: list.reduce((a, e) => a + e.leftSeconds + e.rightSeconds, 0),
      left: list.reduce((a, e) => a + e.leftSeconds, 0),
      right: list.reduce((a, e) => a + e.rightSeconds, 0),
      oz: list.reduce((a, e) => a + (e.bottleOunces ?? 0), 0),
      wet: diapers.filter((d) => d.at >= start.getTime() && diaperKinds(d).includes('wet')).length + list.filter((e) => entryDiaperKinds(e).includes('wet')).length,
      stool: diapers.filter((d) => d.at >= start.getTime() && diaperKinds(d).includes('stool')).length + list.filter((e) => entryDiaperKinds(e).includes('stool')).length,
    }
  }, [entries, diapers])

  const lastFeed = entries[0]
  const minsSinceLast = lastFeed && now ? Math.floor((now - lastFeed.endedAt) / 60000) : null
  const avgGapMinutes = useMemo(() => {
    const recent = entries.slice(0, 8).filter((entry) => entry.endedAt > 0).sort((a, b) => a.endedAt - b.endedAt)
    if (recent.length < 2) return null
    const gaps = recent.slice(1).map((entry, index) => Math.max(0, entry.endedAt - recent[index].endedAt))
    return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 60000)
  }, [entries])
  const lastFeedMetaText = minsSinceLast === null ? 'No feed history yet' : `${Math.floor(minsSinceLast / 60) > 0 ? `${Math.floor(minsSinceLast / 60)}h ` : ''}${minsSinceLast % 60}m ago`
  const avgGapShortText = avgGapMinutes ? `Avg ${Math.floor(avgGapMinutes / 60) > 0 ? `${Math.floor(avgGapMinutes / 60)}h ` : ''}${avgGapMinutes % 60}m` : null
  const suggestedSide = useMemo<Side>(() => {
    const lastNursing = entries.find((entry) => entry.leftSeconds + entry.rightSeconds > 0)
    if (!lastNursing) return today.left <= today.right ? 'left' : 'right'
    if (lastNursing.leftSeconds === lastNursing.rightSeconds) return today.left <= today.right ? 'left' : 'right'
    return oppositeSide(lastNursing.leftSeconds > lastNursing.rightSeconds ? 'left' : 'right')
  }, [entries, today.left, today.right])
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

  const trend = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i))
      const start = d.getTime(); const end = start + 86400000
      const dayEntries = entries.filter((e) => e.endedAt >= start && e.endedAt < end)
      return { label: d.toLocaleDateString([], { weekday: 'short' }), count: dayEntries.length }
    })
    const max = Math.max(1, ...days.map((d) => d.count))
    return { days, max }
  }, [entries])

  const stats = useMemo(() => {
    const nowDate = new Date(now)
    const dayStart = new Date(nowDate); dayStart.setHours(0, 0, 0, 0)
    const weekStart = dayStart.getTime() - 6 * 86400000
    const recentEntries = entries.filter((entry) => entry.endedAt >= weekStart)
    const totalNursing = recentEntries.reduce((sum, entry) => sum + entry.leftSeconds + entry.rightSeconds, 0)
    const totalBottle = recentEntries.reduce((sum, entry) => sum + (entry.bottleOunces ?? 0), 0)
    const nursingFeeds = recentEntries.filter((entry) => entry.leftSeconds + entry.rightSeconds > 0)
    const avgNursing = nursingFeeds.length ? Math.round(totalNursing / nursingFeeds.length) : 0
    const totalLeft = recentEntries.reduce((sum, entry) => sum + entry.leftSeconds, 0)
    const totalRight = recentEntries.reduce((sum, entry) => sum + entry.rightSeconds, 0)
    const balanceTotal = Math.max(1, totalLeft + totalRight)
    const leftPercent = Math.round((totalLeft / balanceTotal) * 100)
    const bestDay = trend.days.reduce((best, day) => (day.count > best.count ? day : best), trend.days[0] ?? { label: '—', count: 0 })
    const sorted = recentEntries.slice().sort((a, b) => a.endedAt - b.endedAt)
    const gaps = sorted.slice(1).map((entry, index) => Math.max(0, entry.endedAt - sorted[index].endedAt))
    const avgGap = gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 1000) : 0
    const nightFeeds = recentEntries.filter((entry) => {
      const hour = new Date(entry.endedAt).getHours()
      return hour < 6 || hour >= 22
    }).length
    const last24Start = now - 24 * 60 * 60 * 1000
    const last24Entries = entries.filter((entry) => entry.endedAt >= last24Start)
    const avgFeedsPerDay = recentEntries.length ? Math.round((recentEntries.length / 7) * 10) / 10 : 0
    const longestNursing = nursingFeeds.reduce((max, entry) => Math.max(max, entry.leftSeconds + entry.rightSeconds), 0)
    const longestGap = gaps.length ? Math.max(...gaps) : 0
    const bottleFeeds = recentEntries.filter((entry) => (entry.bottleOunces ?? 0) > 0).length
    const diaperWindowStart = weekStart
    const standaloneWet = diapers.filter((diaper) => diaper.at >= diaperWindowStart && diaperKinds(diaper).includes('wet')).length
    const standaloneStool = diapers.filter((diaper) => diaper.at >= diaperWindowStart && diaperKinds(diaper).includes('stool')).length
    const feedWet = recentEntries.filter((entry) => entryDiaperKinds(entry).includes('wet')).length
    const feedStool = recentEntries.filter((entry) => entryDiaperKinds(entry).includes('stool')).length
    const wetCount = standaloneWet + feedWet
    const stoolCount = standaloneStool + feedStool
    const sideDelta = Math.abs(totalLeft - totalRight)
    const balanceLabel = sideDelta < 5 * 60 ? 'Beautifully balanced' : totalLeft > totalRight ? 'Left leading' : 'Right leading'
    const lastNursing = entries.find((entry) => entry.leftSeconds + entry.rightSeconds > 0)
    const nextSide = !lastNursing || lastNursing.leftSeconds === lastNursing.rightSeconds
      ? (today.left <= today.right ? 'left' : 'right')
      : oppositeSide(lastNursing.leftSeconds > lastNursing.rightSeconds ? 'left' : 'right')
    const nextSideLabel = sideLabel(nextSide)
    const longestGapLabel = longestGap ? formatDuration(Math.round(longestGap / 1000)) : '—'
    const momentumLabel = last24Entries.length >= avgFeedsPerDay ? 'Above weekly pace' : last24Entries.length ? 'Below weekly pace' : 'Quiet 24h'
    return { recentEntries, totalNursing, totalBottle, avgNursing, totalLeft, totalRight, leftPercent, bestDay, avgGap, nightFeeds, last24Entries, avgFeedsPerDay, longestNursing, longestGap, longestGapLabel, bottleFeeds, wetCount, stoolCount, balanceLabel, nextSideLabel, momentumLabel }
  }, [entries, diapers, now, today.left, today.right, trend.days])

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
      <section className="card hero" ref={heroRef}>
        <div className="hero-top"><div className="feed-cues hero-priority-cues"><span className="next-window"><span>Next</span>{' '}<strong>{nextFeedWindowText}{lastFeed ? <> <span className="next-feed-side">{nextFeedSideText}</span></> : null}</strong></span></div>{session ? <span className="pill">{session.activeSide ? `On ${session.activeSide}` : 'Paused'}</span> : null}</div>
        <div className="timer">{formatDuration(activeSeconds)}</div>
        <div className="hero-micro-meta" aria-label="Feed timing summary">
          <span>{lastFeed ? `Last ${lastFeedMetaText}` : lastFeedMetaText}</span>
          {avgGapShortText ? <span>{avgGapShortText}</span> : null}
        </div>
        {session ? (
          <div className="live-split" aria-label="Live split">
            <div className="split-title">Live split</div>
            <div><span>Left</span><strong>{formatDuration(activeSplit.left)}</strong></div>
            <div><span>Right</span><strong>{formatDuration(activeSplit.right)}</strong></div>
            <div><span>Bottle</span><strong>{session.bottleOunces.toFixed(1)} oz</strong></div>
          </div>
        ) : null}
        {!session ? (
          <div className={`start-offset-shell ${startOffsetOpen ? 'expanded' : ''}`}>
            <button type="button" className="start-offset-toggle" aria-label="Adjust start time" aria-expanded={startOffsetOpen} onClick={() => setStartOffsetOpen((open) => !open)}>
              <span>Start time</span>
              <strong>{selectedStartMinutesAgo === 0 ? 'Now' : `${selectedStartMinutesAgo} min ago`}</strong>
            </button>
            {startOffsetOpen ? (
              <div className="start-offset-panel" aria-label="Session start offset">
                <div className="start-tabs" role="tablist" aria-label="Session start input mode">
                  <button type="button" role="tab" aria-selected={startInputMode === 'clock'} className={startInputMode === 'clock' ? 'active-tab' : ''} onClick={() => setStartInputMode('clock')}>Clock time</button>
                  <button type="button" role="tab" aria-selected={startInputMode === 'minutes'} className={startInputMode === 'minutes' ? 'active-tab' : ''} onClick={() => setStartInputMode('minutes')}>Minutes ago</button>
                </div>
                {startInputMode === 'clock' ? (
                  <label>Session start time<input value={startClockText} onChange={(e) => setStartClockText(e.target.value)} placeholder="12:30 PM" /></label>
                ) : (
                  <label>Start minutes ago<input inputMode="decimal" value={startMinutesAgo} onChange={(e) => setStartMinutesAgo(e.target.value)} placeholder="5" /></label>
                )}
                <span className="start-offset-summary">{selectedStartMinutesAgo === 0 ? 'Starting now' : `${selectedStartMinutesAgo} min ago`}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="row hero-actions">
          {!session ? (<><button className="primary jumbo" aria-label={`Start suggested side: ${sideLabel(suggestedSide)}`} onClick={() => startSession(suggestedSide)}>Start {sideLabel(suggestedSide)}</button><button onClick={() => startSession(oppositeSide(suggestedSide))}>Start {sideLabel(oppositeSide(suggestedSide))}</button></>) : (<>{activeSide ? (<><button className="primary" onClick={() => switchSide(activeOppositeSide)}>Switch to {sideLabel(activeOppositeSide)}</button><button className="pause-action" onClick={pause}>Pause</button></>) : (<><button className="primary" onClick={() => resume(suggestedSide)}>Resume {sideLabel(suggestedSide)}</button><button onClick={() => resume(oppositeSide(suggestedSide))}>Resume {sideLabel(oppositeSide(suggestedSide))}</button></>)}<button className="success end-feed" type="button" aria-label="End feed" onClick={endSession}><CirclePause size={16} /> Stop & Save Feed</button><button className="active-clear-link" type="button" aria-label="Clear active feed" onClick={clearSession}><XCircle size={14} /> Clear active</button></>)}
        </div>
        <div className="diaper-panel" role="group" aria-label="Diaper">
          <span className="diaper-panel-label">Diaper</span>
          {(['wet', 'stool'] as DiaperKind[]).map((kind) => {
            const alreadyLogged = session && loggedActiveDiaperKinds.has(kind)
            const selected = selectedDiapers.includes(kind) && !alreadyLogged
            const label = alreadyLogged ? `${diaperLabel(kind)} already logged for this feed` : session ? `Select ${kind} during active feed` : `Select ${kind} diaper`
            return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={label} aria-pressed={selected} disabled={Boolean(alreadyLogged)} onClick={() => toggleDiaperSelection(kind)}>{diaperLabel(kind)}</button>
          })}
          <button type="button" className="diaper-log-button" aria-label="Log selected diapers" disabled={availableSelectedDiapers.length === 0} onClick={logSelectedDiapers}>Log</button>
        </div>
        <div className="additional-options-shell">
          <button type="button" className="additional-options-toggle" aria-label="Additional options" aria-expanded={additionalOptionsOpen} onClick={() => setAdditionalOptionsOpen((open) => !open)}>
            <span>Additional options</span><strong>{additionalOptionsOpen ? 'Hide' : 'Show'}</strong>
          </button>
          {additionalOptionsOpen ? (
            <div className="additional-options-panel">
              <div className="medicine-panel" role="group" aria-label="Bottle feed">
                <span className="diaper-panel-label">Bottle</span>
                <button type="button" aria-label={session ? 'Add bottle to this feed' : 'Log bottle-only feed'} onClick={() => setBottleOpen(true)}><Baby size={14} /> Bottle</button>
              </div>
              {!session ? (
                <div className="medicine-panel" role="group" aria-label="Missed feed">
                  <span className="diaper-panel-label">Missed feed</span>
                  <button type="button" onClick={() => setManualOpen(true)}><CalendarDays size={14} /> Add missed feed</button>
                </div>
              ) : null}
              <div className="medicine-panel" role="group" aria-label="Medicine">
                <span className="diaper-panel-label">Medicine</span>
                <button type="button" aria-label="Log Tylenol" onClick={() => logMedicine('tylenol')}><Pill size={14} /> Tylenol</button>
                <button type="button" aria-label="Log Motrin" onClick={() => logMedicine('motrin')}><Pill size={14} /> Motrin</button>
              </div>
              {session ? <div className="edit-panel"><label>Optional note for this feed<input value={session.note} onChange={(v) => setSession({ ...session, note: v.target.value })} placeholder="optional note" /></label></div> : null}
            </div>
          ) : null}
        </div>
      </section>

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
      <section className="stats-page" aria-label="Stats dashboard">
        <div className="stats-hero card">
          <div className="stats-hero-copy">
            <span className="stats-kicker"><Sparkles size={16} /> 7-day family rhythm</span>
            <h2>{stats.recentEntries.length ? `${stats.recentEntries.length} feeds, beautifully tracked` : 'A beautiful stats story starts here'}</h2>
            <p>{stats.recentEntries.length ? `A calm snapshot of feeding cadence, balance, bottles, and those tiny overnight hero moments.` : 'Log a few feeds and this page turns into a polished readout of your baby’s feeding rhythm.'}</p>
          </div>
          <div className="orbital-stat" aria-label="Weekly feeds"><strong>{stats.recentEntries.length}</strong><span>feeds this week</span></div>
        </div>

        <div className="insight-grid">
          <article className="insight-card primary-insight"><Clock3 size={19} /><span>Average spacing</span><strong>{stats.avgGap ? formatDuration(stats.avgGap) : '—'}</strong><small>between recent feeds</small></article>
          <article className="insight-card"><Droplets size={19} /><span>Total bottle</span><strong>{stats.totalBottle.toFixed(1)} oz</strong><small>{stats.bottleFeeds} bottle feeds this week</small></article>
          <article className="insight-card"><Baby size={19} /><span>Avg nursing</span><strong>{stats.avgNursing ? formatDuration(stats.avgNursing) : '—'}</strong><small>per nursing feed</small></article>
          <article className="insight-card"><Trophy size={19} /><span>Busiest day</span><strong>{stats.bestDay.label}</strong><small>{stats.bestDay.count} feeds logged</small></article>
          <article className="insight-card"><Activity size={19} /><span>24h momentum</span><strong>{stats.last24Entries.length}</strong><small>{stats.momentumLabel}</small></article>
          <article className="insight-card"><Waves size={19} /><span>Longest stretch</span><strong>{stats.longestGapLabel}</strong><small>between feeds this week</small></article>
          <article className="insight-card"><HeartPulse size={19} /><span>Longest nursing</span><strong>{stats.longestNursing ? formatDuration(stats.longestNursing) : '—'}</strong><small>single feed stamina</small></article>
          <article className="insight-card"><Target size={19} /><span>Next side cue</span><strong>{stats.nextSideLabel}</strong><small>{stats.balanceLabel}</small></article>
        </div>

        <section className="stats-story-grid">
          <article className="card story-card glow-story">
            <span className="stats-kicker"><Sparkles size={15} /> Smart read</span>
            <h2>{stats.recentEntries.length ? `${stats.avgFeedsPerDay} feeds/day cadence` : 'Cadence will appear here'}</h2>
            <p>{stats.recentEntries.length ? `The last 24 hours logged ${stats.last24Entries.length} feeds, with the longest calm stretch at ${stats.longestGapLabel}.` : 'Once feeds are logged, this card summarizes pace, recovery windows, and the shape of the week.'}</p>
          </article>
          <article className="card diaper-signal-card">
            <div><span className="muted">Diaper signal</span><div className="diaper-signal-values"><strong>{stats.wetCount}<small>wet</small></strong><strong>{stats.stoolCount}<small>stool</small></strong></div></div>
            <p>Logged alongside feeds and standalone changes for a cleaner weekly care picture.</p>
          </article>
        </section>

        <section className="card rhythm-card">
          <div className="section-heading"><h2>Feeding rhythm</h2><span className="muted">Last 7 days</span></div>
          <div className="rhythm-bars">{trend.days.map((day) => <div key={day.label} className="rhythm-day"><div className="rhythm-track"><div style={{ height: `${Math.max(10, (day.count / trend.max) * 100)}%` }} /></div><strong>{day.count}</strong><span>{day.label}</span></div>)}</div>
        </section>

        <section className="stats-split">
          <article className="card balance-card">
            <div className="section-heading"><h2>Side balance</h2><span className="muted">L / R</span></div>
            <div className="balance-orb" style={{ '--left': `${stats.leftPercent}%` } as CSSProperties}><strong>{stats.leftPercent}%</strong><span>left</span></div>
            <div className="balance-labels"><span>L {formatDuration(stats.totalLeft)}</span><span>R {formatDuration(stats.totalRight)}</span></div>
          </article>
          <article className="card night-card">
            <CalendarDays size={22} />
            <h2>Night watch</h2>
            <strong>{stats.nightFeeds}</strong>
            <p>feeds logged between 10 PM and 6 AM this week.</p>
          </article>
        </section>
      </section>
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

      {view === 'track' ? <section className="card timeline-card"><div className="section-heading"><h2>Timeline</h2><span className="muted">Latest first</span></div>{entries.length === 0 && diapers.length === 0 && medicines.length === 0 ? <p className="muted">No feeds yet. Start with left/right, quick bottle, diaper, or medicine log.</p> : <ul className="timeline">{[
        ...entries.map((entry) => ({ kind: 'feed' as const, time: entry.endedAt, entry })),
        ...diapers.map((diaper) => ({ kind: 'diaper' as const, time: diaper.at, diaper })),
        ...medicines.map((medicine) => ({ kind: 'medicine' as const, time: medicine.at, medicine })),
      ].sort((a, b) => b.time - a.time).map((item, index) => {
        if (item.kind === 'medicine') {
          const medicine = item.medicine
          const isEditingMedicine = editingMedicine?.id === medicine.id
          const menuOpen = openEntryMenuId === medicine.id
          const confirmingDelete = confirmingDeleteEntryId === medicine.id
          return <li key={medicine.id} className={`timeline-item timeline-medicine timeline-medicine-${medicine.kind} ${menuOpen ? 'menu-open' : ''}`}><div className="timeline-row"><div className="timeline-main"><div className="timeline-head"><strong>{formatTime(medicine.at)}</strong><span className={`badge badge-medicine badge-medicine-${medicine.kind}`}><Pill size={13} /> {medicineLabel(medicine.kind)}</span></div><span className="timeline-age">{formatDistanceToNow(medicine.at, { addSuffix: true })}</span></div>{!isEditingMedicine ? <div className="entry-action-wrap"><button type="button" className="entry-action-trigger" aria-label="Medicine actions" aria-expanded={menuOpen} onClick={() => { setOpenEntryMenuId(menuOpen ? null : medicine.id); setConfirmingDeleteEntryId(null) }}><MoreHorizontal size={17} /></button>{menuOpen ? <div className="entry-menu" role="menu"><button type="button" role="menuitem" aria-label="Edit medicine" onClick={() => startMedicineEdit(medicine)}><Pencil size={15} /> Edit</button><button type="button" role="menuitem" aria-label="Delete medicine" className="danger-menu" onClick={() => setConfirmingDeleteEntryId(medicine.id)}><Trash2 size={15} /> Delete</button>{confirmingDelete ? <div className="delete-confirm"><span>Are you sure?</span><button type="button" role="menuitem" aria-label="Confirm delete medicine" className="confirm-delete" onClick={() => deleteMedicine(medicine)}>Confirm delete</button></div> : null}</div> : null}</div> : null}</div>{isEditingMedicine ? <div className="edit-panel"><div className="diaper-edit-panel" role="group" aria-label="Edit medicine kind">{(['tylenol', 'motrin'] as MedicineKind[]).map((kind) => { const selected = editingMedicine.kind === kind; return <button key={kind} type="button" className={`medicine-chip ${selected ? 'selected' : ''}`} aria-label={`Select ${medicineLabel(kind)}`} aria-pressed={selected} onClick={() => setEditingMedicine({ ...editingMedicine, kind })}><Pill size={14} /> {medicineLabel(kind)}</button> })}</div><label>Medicine time<input aria-label="Medicine time" value={editingMedicine.time} onChange={(event) => setEditingMedicine({ ...editingMedicine, time: event.target.value })} placeholder="9:15 AM" /></label><div className="row"><button className="primary" aria-label="Save medicine" onClick={() => saveMedicineEdit(medicine)}><Save size={15} /> Save</button><button onClick={() => setEditingMedicine(null)}>Cancel</button></div></div> : null}</li>
        }
        if (item.kind === 'diaper') {
          const diaper = item.diaper
          const kinds = diaperKinds(diaper)
          const isEditingDiaper = editingDiaper?.id === diaper.id
          const menuOpen = openEntryMenuId === diaper.id
          const confirmingDelete = confirmingDeleteEntryId === diaper.id
          return <li key={diaper.id} className={`timeline-item timeline-diaper timeline-diaper-${kinds.includes('stool') ? 'stool' : 'wet'} ${menuOpen ? 'menu-open' : ''}`}><div className="timeline-row"><div className="timeline-main"><div className="timeline-head"><strong>{formatTime(diaper.at)}</strong><span className={`badge badge-diaper ${kinds.includes('stool') ? 'badge-diaper-stool' : ''}`}>{diaperEventLabel(diaper)}</span></div><span className="timeline-age">{formatDistanceToNow(diaper.at, { addSuffix: true })}</span></div>{!isEditingDiaper ? <div className="entry-action-wrap"><button type="button" className="entry-action-trigger" aria-label="Diaper actions" aria-expanded={menuOpen} onClick={() => { setOpenEntryMenuId(menuOpen ? null : diaper.id); setConfirmingDeleteEntryId(null) }}><MoreHorizontal size={17} /></button>{menuOpen ? <div className="entry-menu" role="menu"><button type="button" role="menuitem" aria-label="Edit diaper" onClick={() => { setEditingDiaper({ id: diaper.id, kinds }); setOpenEntryMenuId(null) }}><Pencil size={15} /> Edit</button><button type="button" role="menuitem" aria-label="Delete diaper" className="danger-menu" onClick={() => setConfirmingDeleteEntryId(diaper.id)}><Trash2 size={15} /> Delete</button>{confirmingDelete ? <div className="delete-confirm"><span>Are you sure?</span><button type="button" role="menuitem" aria-label="Confirm delete diaper" className="confirm-delete" onClick={() => deleteDiaper(diaper)}>Confirm delete</button></div> : null}</div> : null}</div> : null}</div>{isEditingDiaper ? <div className="edit-panel diaper-edit-panel" role="group" aria-label="Edit diaper">{(['wet', 'stool'] as DiaperKind[]).map((kind) => { const selected = editingDiaper.kinds.includes(kind); return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={`Select ${kind} diaper`} aria-pressed={selected} onClick={() => toggleEditingDiaperKind(kind)}>{diaperLabel(kind)}</button> })}<div className="row"><button type="button" className="primary" aria-label="Save diaper" onClick={() => saveDiaperEdit(diaper)}><Save size={15} /> Save</button><button type="button" onClick={() => setEditingDiaper(null)}>Cancel</button></div></div> : null}</li>
        }
        const e = item.entry
        const showInlineResume = index < 2
        const isEditing = editing?.id === e.id
        const total = e.leftSeconds + e.rightSeconds
        const hasBottle = Boolean(e.bottleOunces)
        const menuOpen = openEntryMenuId === e.id
        const confirmingDelete = confirmingDeleteEntryId === e.id
        return (
          <li key={e.id} className={`timeline-item timeline-${e.type} ${menuOpen ? 'menu-open' : ''}`}>
            <div className="timeline-row">
              <div className="timeline-main">
                <div className="timeline-head">
                  <strong>{formatTime(e.startedAt)}</strong>
                  <span className={`badge badge-${e.type}`}>{timelineFeedLabel(e)}</span>
                  {entryDiaperKinds(e).length ? <span className="badge badge-diaper">{diaperKindsLabel(entryDiaperKinds(e))}</span> : null}
                  <div className="timeline-metrics" aria-label="Feed details">
                    {e.leftSeconds > 0 && e.rightSeconds > 0 ? <span className="metric primary-metric">{formatDuration(total)} total</span> : null}
                    {e.leftSeconds > 0 ? <span className={`metric side-metric ${e.rightSeconds === 0 ? 'primary-metric' : ''}`}>{e.rightSeconds > 0 ? `Left: ${formatDuration(e.leftSeconds)}` : formatDuration(e.leftSeconds)}</span> : null}
                    {e.rightSeconds > 0 ? <span className={`metric side-metric ${e.leftSeconds === 0 ? 'primary-metric' : ''}`}>{e.leftSeconds > 0 ? `Right: ${formatDuration(e.rightSeconds)}` : formatDuration(e.rightSeconds)}</span> : null}
                    {hasBottle ? <span className={`metric bottle-metric ${total === 0 ? 'primary-metric' : ''}`}>{e.bottleOunces?.toFixed(1)} oz</span> : null}
                  </div>
                </div>
                <span className="timeline-age">{formatDistanceToNow(e.endedAt, { addSuffix: true })}</span>
                {e.note ? <div className="note-chip">📝 {e.note}</div> : null}
              </div>
              {!isEditing ? (
                <div className="entry-action-wrap">
                  {showInlineResume ? <button type="button" className="inline-resume" aria-label="Resume recent entry" onClick={() => resumeEntry(e)}>Resume</button> : null}
                  <button type="button" className="entry-action-trigger" aria-label="Entry actions" aria-expanded={menuOpen} onClick={() => { setOpenEntryMenuId(menuOpen ? null : e.id); setConfirmingDeleteEntryId(null) }}><MoreHorizontal size={17} /></button>
                  {menuOpen ? (
                    <div className="entry-menu" role="menu">
                      <button type="button" role="menuitem" aria-label="Edit entry" onClick={() => { setEditing({ id: e.id, leftMinutes: String(Math.round(e.leftSeconds / 60)), rightMinutes: String(Math.round(e.rightSeconds / 60)), bottleOunces: e.bottleOunces ? String(e.bottleOunces) : '', note: e.note ?? '', diaperKinds: entryDiaperKinds(e) }); setOpenEntryMenuId(null) }}><Pencil size={15} /> Edit</button>
                      <button type="button" role="menuitem" aria-label="Resume session" onClick={() => resumeEntry(e)}><RotateCcw size={15} /> Resume</button>
                      <button type="button" role="menuitem" aria-label="Delete entry" className="danger-menu" onClick={() => setConfirmingDeleteEntryId(e.id)}><Trash2 size={15} /> Delete</button>
                      {confirmingDelete ? <div className="delete-confirm"><span>Are you sure?</span><button type="button" role="menuitem" aria-label="Confirm delete entry" className="confirm-delete" onClick={() => deleteEntry(e)}>Confirm delete</button></div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {isEditing ? (
              <div className="edit-panel">
                <div className="manual-grid">
                  <label>Left minutes<input inputMode="decimal" value={editing.leftMinutes} onChange={(event) => setEditing({ ...editing, leftMinutes: event.target.value })} /></label>
                  <label>Right minutes<input inputMode="decimal" value={editing.rightMinutes} onChange={(event) => setEditing({ ...editing, rightMinutes: event.target.value })} /></label>
                  <label>Bottle ounces<input inputMode="decimal" value={editing.bottleOunces} onChange={(event) => setEditing({ ...editing, bottleOunces: event.target.value })} placeholder="e.g. 2.5" /></label>
                  <label>Note<input value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} /></label>
                </div>
                <div className="diaper-edit-panel" role="group" aria-label="Edit entry diapers">
                  <span className="diaper-panel-label">Diaper</span>
                  {(['wet', 'stool'] as DiaperKind[]).map((kind) => {
                    const selected = editing.diaperKinds.includes(kind)
                    return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={`${selected ? 'Remove' : 'Add'} ${kind} diaper from entry`} aria-pressed={selected} onClick={() => toggleEditingEntryDiaperKind(kind)}>{diaperLabel(kind)}</button>
                  })}
                </div>
                <div className="row">
                  <button className="primary" onClick={() => {
                    const leftSeconds = Math.max(0, Math.round((Number(editing.leftMinutes) || 0) * 60))
                    const rightSeconds = Math.max(0, Math.round((Number(editing.rightMinutes) || 0) * 60))
                    const bottle = Number(editing.bottleOunces) > 0 ? Number(editing.bottleOunces) : null
                    const type: FeedType = bottle && leftSeconds + rightSeconds > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
                    setEntries((prev) => prev.map((entry) => entry.id === e.id ? { ...entry, type, leftSeconds, rightSeconds, bottleOunces: bottle, note: editing.note.trim(), diaperKinds: editing.diaperKinds } : entry).sort((a, b) => b.endedAt - a.endedAt))
                    setEditing(null)
                    showToast('Entry updated')
                  }}><Save size={15} /> Save</button>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          </li>
        )
      })}</ul>}</section> : null}

      {(toast || undoState) && <div className="toast"><span>{toast || undoToastText}</span>{undoState && <button aria-label={undoLabel} onClick={undo}><RotateCcw size={15} /> Undo</button>}</div>}
    </main>
  )
}

export default App
