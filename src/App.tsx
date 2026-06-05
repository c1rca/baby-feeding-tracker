import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Baby, CirclePause, Download, MoreHorizontal, Moon, Pencil, RotateCcw, Save, Settings, Sun, Trash2, Upload, XCircle } from 'lucide-react'
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
}
type Session = { startedAt: number; activeSide: Side | null; segmentStart: number | null; segments: Segment[]; bottleOunces: number; note: string }
type LegacySession = Omit<Session, 'note' | 'bottleOunces'> & { note?: string; bottleOunces?: number }
type UndoState =
  | { entry: Entry; timeoutId: number; kind: 'delete' | 'resume'; previousSession?: Session | null }
  | { session: Session; timeoutId: number; kind: 'clear-session' }
type EditingState = { id: string; leftMinutes: string; rightMinutes: string; bottleOunces: string; note: string } | null
type Theme = 'light' | 'dark'

const KEY_ENTRIES = 'baby-feeding-tracker:v1:entries'
const KEY_SESSION = 'baby-feeding-tracker:v1:session'
const KEY_THEME = 'baby-feeding-tracker:v1:theme'
const KEY_SETTINGS_OPEN = 'baby-feeding-tracker:v1:settings-open'
const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'
const KEY_FEEDING_NOTIFICATIONS = 'baby-feeding-tracker:v1:feeding-notifications'
const API_STATE = '/api/state'
const API_NOTIFICATION_SETTINGS = '/api/notification-settings'
const NOTIFICATION_APP_URL = 'https://feedr.kjw.lol'
const NEXT_FEEDING_REMINDER_OFFSETS_MS = [2 * 60 * 60 * 1000, 3 * 60 * 60 * 1000]
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
const oppositeSide = (side: Side): Side => (side === 'left' ? 'right' : 'left')
const makeId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `feed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

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
  }
}

const entryToPausedSession = (entry: Entry): Session => {
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
    activeSide: null,
    segmentStart: null,
    segments,
    bottleOunces: entry.bottleOunces ?? 0,
    note: entry.note ?? '',
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
  const [theme, setTheme] = useState<Theme>(() => getCookieTheme() || (localStorage.getItem(KEY_THEME) as Theme) || 'light')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bottleOpen, setBottleOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDraft, setManualDraft] = useState({ leftMinutes: '', rightMinutes: '', bottleOunces: '', note: '' })
  const [bottleQuickOz, setBottleQuickOz] = useState(2)
  const [startInputMode, setStartInputMode] = useState<'clock' | 'minutes'>('clock')
  const [startOffsetOpen, setStartOffsetOpen] = useState(false)
  const [startClockText, setStartClockText] = useState(() => formatClockInput(Date.now()))
  const [startMinutesAgo, setStartMinutesAgo] = useState('0')
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState('')
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [editing, setEditing] = useState<EditingState>(null)
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
  const latestPayloadRef = useRef<{ entries: Entry[]; session: Session | null; theme: Theme }>({ entries, session, theme })

  useEffect(() => { latestPayloadRef.current = { entries, session, theme } }, [entries, session, theme])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    if (!resumeFocusTick || !session) return
    window.requestAnimationFrame(() => {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const primaryControl = heroRef.current?.querySelector<HTMLButtonElement>('.hero-actions button')
      primaryControl?.focus({ preventScroll: true })
    })
  }, [resumeFocusTick, session])
  useEffect(() => localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries)), [entries])
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

  const syncToApi = useCallback(async (nextEntries?: Entry[], nextSession?: Session | null, nextTheme?: Theme) => {
    const payload = latestPayloadRef.current
    const entriesToSync = nextEntries ?? payload.entries
    const sessionToSync = nextSession ?? payload.session
    const themeToSync = nextTheme ?? payload.theme
    setSyncStatus('syncing')
    try {
      const response = await fetch(API_STATE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entriesToSync, session: sessionToSync, theme: themeToSync }),
      })
      if (!response.ok) throw new Error('sync failed')
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
        const data = (await response.json()) as { entries?: Entry[]; session?: LegacySession | null; theme?: Theme }
        if (Array.isArray(data.entries)) setEntries(data.entries.sort((a, b) => b.endedAt - a.endedAt))
        if (data.session !== undefined) setSession(normalizeSession(data.session))
        if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme)
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
  }, [entries, session, theme, hasHydrated, syncToApi])

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

  const startSession = (side: Side) => { const t = Date.now(); const startedAt = Math.min(selectedStartTime, t); setNow(t); setSession({ startedAt, activeSide: side, segmentStart: startedAt, segments: [], bottleOunces: 0, note: '' }) }
  const switchSide = (side: Side) => { if (!session || !session.activeSide || !session.segmentStart) return; const t = Date.now(); setSession({ ...session, segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }], activeSide: side, segmentStart: t }) }
  const pause = () => { if (!session || !session.activeSide || !session.segmentStart) return; const t = Date.now(); setSession({ ...session, segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }], activeSide: null, segmentStart: null }) }
  const resume = (side: Side) => { if (!session) return; const t = Date.now(); setNow(t); setSession({ ...session, activeSide: side, segmentStart: t }) }

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
    setEntries((prev) => [{ id: makeId(), type, startedAt: session.startedAt, endedAt: t, leftSeconds: left, rightSeconds: right, bottleOunces: bottle, note: session.note.trim() || '' }, ...prev])
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

  const resumeEntry = (entry: Entry) => {
    if (session) return showToast('Finish or clear the active feed before resuming another entry')
    if (undoState) window.clearTimeout(undoState.timeoutId)
    const previousSession = session
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    setSession(entryToPausedSession(entry))
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
    }
  }, [entries])

  const lastFeed = entries[0]
  const minsSinceLast = lastFeed && now ? Math.floor((now - lastFeed.endedAt) / 60000) : null
  const avgGapMinutes = useMemo(() => {
    const recent = entries.slice(0, 8).filter((entry) => entry.endedAt > 0).sort((a, b) => a.endedAt - b.endedAt)
    if (recent.length < 2) return null
    const gaps = recent.slice(1).map((entry, index) => Math.max(0, entry.endedAt - recent[index].endedAt))
    return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 60000)
  }, [entries])
  const lastFeedMetaText = minsSinceLast === null ? 'No feed history yet' : `${Math.floor(minsSinceLast / 60) > 0 ? `${Math.floor(minsSinceLast / 60)}h ` : ''}${minsSinceLast % 60}m ago`
  const avgGapText = avgGapMinutes ? `Avg ${Math.floor(avgGapMinutes / 60) > 0 ? `${Math.floor(avgGapMinutes / 60)}h ` : ''}${avgGapMinutes % 60}m between feeds` : null
  const nextFeedWindowText = lastFeed ? formatShortTimeRange(lastFeed.endedAt + 2 * 60 * 60 * 1000, lastFeed.endedAt + 3 * 60 * 60 * 1000) : 'After first feed'

  useEffect(() => {
    if (!feedingNotificationsEnabled || notificationPermission !== 'granted' || !lastFeed || typeof Notification === 'undefined') return
    const timers = NEXT_FEEDING_REMINDER_OFFSETS_MS
      .map((offsetMs) => ({ offsetMs, delayMs: lastFeed.endedAt + offsetMs - Date.now() }))
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
  const suggestedSide = useMemo<Side>(() => {
    const lastNursing = entries.find((entry) => entry.leftSeconds + entry.rightSeconds > 0)
    if (!lastNursing) return today.left <= today.right ? 'left' : 'right'
    if (lastNursing.leftSeconds === lastNursing.rightSeconds) return today.left <= today.right ? 'left' : 'right'
    return oppositeSide(lastNursing.leftSeconds > lastNursing.rightSeconds ? 'left' : 'right')
  }, [entries, today.left, today.right])

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

  return (
    <main className="app">
      <header className="top">
        <h1><Baby size={20} /> Baby Feeding Tracker</h1>
        <div className="top-actions">
          <span className={`sync-pill sync-${syncStatus}`}>{syncStatus === 'synced' ? 'Synced' : syncStatus === 'syncing' ? 'Syncing…' : 'Offline changes saved'}</span>
          <button className="icon-plain" aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button className="icon-plain" aria-label={settingsOpen ? 'Hide settings' : 'Show settings'} onClick={() => setSettingsOpen((v) => !v)}>
            <Settings size={17} />
          </button>
        </div>
      </header>

      <section className="card hero" ref={heroRef}>
        <div className="hero-top"><h2>Active Feed</h2><span className="pill">{session?.activeSide ? `On ${session.activeSide}` : session ? 'Paused' : 'Ready'}</span></div>
        {avgGapText ? <p className="muted hero-average">{avgGapText}</p> : null}
        <div className="feed-cues"><span className="suggestion">Suggested: {sideLabel(suggestedSide)}</span><span className="next-window"><span>Next feed</span><strong>{nextFeedWindowText}</strong></span></div>
        <p className="muted">{lastFeed ? `Last feed ${lastFeedMetaText}` : lastFeedMetaText}</p>
        <div className="timer">{formatDuration(activeSeconds)}</div>
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
          {!session ? (<><button className="primary jumbo" aria-label={`Start suggested side: ${sideLabel(suggestedSide)}`} onClick={() => startSession(suggestedSide)}>Start {sideLabel(suggestedSide)}</button><button onClick={() => startSession(oppositeSide(suggestedSide))}>Start {sideLabel(oppositeSide(suggestedSide))}</button><button aria-label="Log bottle-only feed" onClick={() => setBottleOpen(true)}><Baby size={16} /> Bottle</button><button onClick={() => setManualOpen(true)}>Add missed feed</button></>) : (<>{activeSide ? (<><button className="primary" onClick={() => switchSide(activeOppositeSide)}>Switch to {sideLabel(activeOppositeSide)}</button><button onClick={pause}>Pause</button></>) : (<><button className="primary" onClick={() => resume(suggestedSide)}>Resume {sideLabel(suggestedSide)}</button><button onClick={() => resume(oppositeSide(suggestedSide))}>Resume {sideLabel(oppositeSide(suggestedSide))}</button></>)}<button aria-label="Add bottle to this feed" onClick={() => setBottleOpen(true)}><Baby size={16} /> Bottle</button><button className="success end-feed" type="button" aria-label="End feed" onClick={endSession}><CirclePause size={16} /> Stop & Save Feed</button><button className="subtle-danger" type="button" aria-label="Clear active feed" onClick={clearSession}><XCircle size={16} /> Clear active</button></>)}
        </div>
        {session && <div className="edit-panel"><label>Optional note for this feed<input value={session.note} onChange={(v) => setSession({ ...session, note: v.target.value })} placeholder="optional note" /></label></div>}
      </section>

      <section className="grid">
        <div className="card stat"><h3>Feeds today</h3><p>{today.count}</p></div>
        <div className="card stat"><h3>Nursing</h3><p>{formatDuration(today.nursing)}</p></div>
        <div className="card stat"><h3>Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div>
        <div className="card stat"><h3>L / R split</h3><p>{formatDuration(today.left)} / {formatDuration(today.right)}</p></div>
      </section>

      <section className="card">
        <h2>7-Day Trend</h2>
        <div className="trend">{trend.days.map((d) => <div key={d.label} className="trend-col"><div className="trend-bar" style={{ height: `${(d.count / trend.max) * 60 + 8}px` }} /><span>{d.label}</span><small>{d.count}</small></div>)}</div>
      </section>

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
            <div className="row"><button aria-label="Export JSON" onClick={() => { const payload = { version: 1, exportedAt: new Date().toISOString(), entries }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `feeding-tracker-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); showToast('Data exported') }}><Download size={16} /> Export JSON</button><button aria-label="Import JSON" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import JSON</button><button className="danger" onClick={() => { if (!window.confirm('Clear all feeding data? Export a backup first if needed.')) return; setEntries([]); setSession(null); setUndoState(null); showToast('All data cleared') }}><Trash2 size={16} /> Clear all data</button></div>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const text = await file.text(); try { const parsed = JSON.parse(text) as { entries?: Entry[] }; if (!parsed.entries) throw new Error('Invalid data'); setEntries(parsed.entries.sort((a, b) => b.endedAt - a.endedAt)); showToast('Data imported') } catch { showToast('Import failed: invalid file') } finally { event.target.value = '' } }} />
          </section>
        </div>
      ) : null}

      <section className="card timeline-card"><div className="section-heading"><h2>Timeline</h2><span className="muted">Latest first</span></div>{entries.length === 0 ? <p className="muted">No feeds yet. Start with left/right or quick bottle.</p> : <ul className="timeline">{entries.map((e, index) => { const showInlineResume = index < 2; const isEditing = editing?.id === e.id; const total = e.leftSeconds + e.rightSeconds; const hasBottle = Boolean(e.bottleOunces); const menuOpen = openEntryMenuId === e.id; const confirmingDelete = confirmingDeleteEntryId === e.id; return <li key={e.id} className={`timeline-item timeline-${e.type} ${menuOpen ? 'menu-open' : ''}`}><div className="timeline-row"><div className="timeline-main"><div className="timeline-head"><strong>{formatTime(e.startedAt)}</strong><span className={`badge badge-${e.type}`}>{e.type}</span><span className="muted">{formatDistanceToNow(e.endedAt, { addSuffix: true })}</span></div><div className="timeline-metrics" aria-label="Feed details">{total > 0 ? <span className="metric primary-metric">{formatDuration(total)} total</span> : null}{e.leftSeconds > 0 ? <span className="metric">L {formatDuration(e.leftSeconds)}</span> : null}{e.rightSeconds > 0 ? <span className="metric">R {formatDuration(e.rightSeconds)}</span> : null}{hasBottle ? <span className="metric bottle-metric">{e.bottleOunces?.toFixed(1)} oz</span> : null}</div>{e.note ? <div className="note-chip">📝 {e.note}</div> : null}</div>{!isEditing ? <div className="entry-action-wrap">{showInlineResume ? <button type="button" className="inline-resume" aria-label="Resume recent entry" onClick={() => resumeEntry(e)}><RotateCcw size={14} /> Resume</button> : null}<button className="entry-action-trigger" aria-label="Entry actions" aria-expanded={menuOpen} onClick={() => { setConfirmingDeleteEntryId(null); setOpenEntryMenuId(menuOpen ? null : e.id) }}><MoreHorizontal size={17} /></button>{menuOpen ? <div className="entry-menu" role="menu"><button role="menuitem" aria-label="Resume session" onClick={() => { setOpenEntryMenuId(null); resumeEntry(e) }}><RotateCcw size={15} /> Resume</button><button role="menuitem" aria-label="Edit entry" onClick={() => { setOpenEntryMenuId(null); setEditing({ id: e.id, leftMinutes: String(Math.round(e.leftSeconds / 60)), rightMinutes: String(Math.round(e.rightSeconds / 60)), bottleOunces: e.bottleOunces ? e.bottleOunces.toFixed(1) : '', note: e.note ?? '' }) }}><Pencil size={15} /> Edit</button>{confirmingDelete ? <div className="delete-confirm"><span>Are you sure?</span><button role="menuitem" className="danger-menu confirm-delete" aria-label="Confirm delete entry" onClick={() => deleteEntry(e)}><Trash2 size={15} /> Delete</button><button role="menuitem" aria-label="Cancel delete" onClick={() => setConfirmingDeleteEntryId(null)}>Cancel</button></div> : <button role="menuitem" className="danger-menu" aria-label="Delete entry" onClick={() => setConfirmingDeleteEntryId(e.id)}><Trash2 size={15} /> Delete</button>}</div> : null}</div> : null}</div>{isEditing ? <div className="edit-panel"><div className="manual-grid compact"><label>Left minutes<input inputMode="decimal" value={editing.leftMinutes} onChange={(v) => setEditing({ ...editing, leftMinutes: v.target.value })} placeholder="0" /></label><label>Right minutes<input inputMode="decimal" value={editing.rightMinutes} onChange={(v) => setEditing({ ...editing, rightMinutes: v.target.value })} placeholder="0" /></label><label>Ounces<input inputMode="decimal" value={editing.bottleOunces} onChange={(v) => setEditing({ ...editing, bottleOunces: v.target.value })} placeholder="e.g. 2.5" /></label><label>Note<input value={editing.note} onChange={(v) => setEditing({ ...editing, note: v.target.value })} placeholder="optional" /></label></div><div className="row"><button className="primary" aria-label="Save entry" onClick={() => { const nextLeft = Math.max(0, Math.round((Number(editing.leftMinutes) || 0) * 60)); const nextRight = Math.max(0, Math.round((Number(editing.rightMinutes) || 0) * 60)); const nextOz = editing.bottleOunces.trim() ? Number(editing.bottleOunces) : null; const safeOz = Number.isFinite(nextOz) && nextOz !== null && nextOz > 0 ? nextOz : null; const nextType: FeedType = safeOz && nextLeft + nextRight > 0 ? 'mixed' : safeOz ? 'bottle' : 'breast'; setEntries((prev) => prev.map((x) => x.id === editing.id ? { ...x, type: nextType, leftSeconds: nextLeft, rightSeconds: nextRight, bottleOunces: safeOz, note: editing.note.trim() } : x)); setEditing(null); showToast('Entry updated') }}><Save size={16} /> Save</button><button onClick={() => setEditing(null)}>Cancel</button></div></div> : null}</li> })}</ul>}</section>

      {(toast || undoState) && <div className="toast"><span>{toast || (undoState?.kind === 'resume' ? 'Session resumed' : undoState?.kind === 'clear-session' ? 'Active feed cleared' : 'Entry deleted')}</span>{undoState && <button aria-label={undoState.kind === 'resume' ? 'Undo resume' : undoState.kind === 'clear-session' ? 'Undo clear active feed' : 'Undo delete'} onClick={() => { if (!undoState) return; window.clearTimeout(undoState.timeoutId); if (undoState.kind === 'clear-session') { setSession(undoState.session); showToast('Active feed restored') } else { setEntries((prev) => [undoState.entry, ...prev].sort((a, b) => b.endedAt - a.endedAt)); if (undoState.kind === 'resume') setSession(undoState.previousSession ?? null); showToast(undoState.kind === 'resume' ? 'Resume undone' : 'Deletion undone') } setUndoState(null) }}><RotateCcw size={15} /> Undo</button>}</div>}
    </main>
  )
}

export default App
