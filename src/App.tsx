import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Baby, CirclePause, Download, Moon, Pencil, RotateCcw, Save, Settings, Sun, Trash2, Upload, XCircle } from 'lucide-react'
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
type UndoState = { entry: Entry; timeoutId: number; kind: 'delete' | 'resume'; previousSession?: Session | null }
type EditingState = { id: string; leftMinutes: string; rightMinutes: string; bottleOunces: string; note: string } | null
type Theme = 'light' | 'dark'

const KEY_ENTRIES = 'baby-feeding-tracker:v1:entries'
const KEY_SESSION = 'baby-feeding-tracker:v1:session'
const KEY_THEME = 'baby-feeding-tracker:v1:theme'
const KEY_SETTINGS_OPEN = 'baby-feeding-tracker:v1:settings-open'
const KEY_PENDING_SYNC = 'baby-feeding-tracker:v1:pending-sync'
const API_STATE = '/api/state'
const THEME_COOKIE = 'baby_feeding_theme'

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const sideLabel = (side: Side) => (side === 'left' ? 'Left' : 'Right')
const oppositeSide = (side: Side): Side => (side === 'left' ? 'right' : 'left')
const makeId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `feed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
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
  const [now, setNow] = useState(0)
  const [toast, setToast] = useState('')
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [editing, setEditing] = useState<EditingState>(null)
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline'>(() => (localStorage.getItem(KEY_PENDING_SYNC) === '1' ? 'offline' : 'synced'))
  const [hasHydrated, setHasHydrated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const latestPayloadRef = useRef<{ entries: Entry[]; session: Session | null; theme: Theme }>({ entries, session, theme })

  useEffect(() => { latestPayloadRef.current = { entries, session, theme } }, [entries, session, theme])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries)), [entries])
  useEffect(() => localStorage.setItem(KEY_SESSION, JSON.stringify(session)), [session])
  useEffect(() => {
    localStorage.setItem(KEY_THEME, theme)
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => localStorage.setItem(KEY_SETTINGS_OPEN, settingsOpen ? '1' : '0'), [settingsOpen])
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setBottleOpen(false)
      setManualOpen(false)
      setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  const startSession = (side: Side) => { const t = Date.now(); setNow(t); setSession({ startedAt: t, activeSide: side, segmentStart: t, segments: [], bottleOunces: 0, note: '' }) }
  const switchSide = (side: Side) => { if (!session || !session.activeSide || !session.segmentStart) return; const t = Date.now(); setSession({ ...session, segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }], activeSide: side, segmentStart: t }) }
  const pause = () => { if (!session || !session.activeSide || !session.segmentStart) return; const t = Date.now(); setSession({ ...session, segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }], activeSide: null, segmentStart: null }) }
  const resume = (side: Side) => { if (!session) return; const t = Date.now(); setNow(t); setSession({ ...session, activeSide: side, segmentStart: t }) }

  const clearSession = () => {
    if (!session) return showToast('No active feed to clear')
    setSession(null)
    setBottleOpen(false)
    showToast('Active feed cleared')
  }

  const endSession = () => {
    if (!session) return showToast('No active feed to end')
    const t = Date.now()
    const finished = [...session.segments]
    if (session.activeSide && session.segmentStart) finished.push({ side: session.activeSide, startedAt: session.segmentStart, endedAt: t })
    const { left, right } = sumSideDurations(finished)
    const bottle = session.bottleOunces > 0 ? session.bottleOunces : null
    const type: FeedType = bottle && left + right > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
    setEntries((prev) => [{ id: makeId(), type, startedAt: session.startedAt, endedAt: t, leftSeconds: left, rightSeconds: right, bottleOunces: bottle, note: session.note.trim() || '' }, ...prev])
    setSession(null)
    showToast('Feed saved')
  }

  const resumeEntry = (entry: Entry) => {
    if (session) return showToast('Finish or clear the active feed before resuming another entry')
    if (undoState) window.clearTimeout(undoState.timeoutId)
    const previousSession = session
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    setSession(entryToPausedSession(entry))
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
    const endedAt = Date.now()
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
  const nextDueText = minsSinceLast === null ? 'No previous feed yet' : `Last feed: ${Math.floor(minsSinceLast / 60) > 0 ? `${Math.floor(minsSinceLast / 60)}h ` : ''}${minsSinceLast % 60}m ago${avgGapMinutes ? ` · Avg gap today: ${Math.floor(avgGapMinutes / 60) > 0 ? `${Math.floor(avgGapMinutes / 60)}h ` : ''}${avgGapMinutes % 60}m` : ''}`
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

      <section className="card hero">
        <div className="hero-top"><h2>Active Feed</h2><span className="pill">{session?.activeSide ? `On ${session.activeSide}` : session ? 'Paused' : 'Ready'}</span></div>
        <p className="muted">{lastFeed ? `Last feed ${formatDistanceToNow(lastFeed.endedAt, { addSuffix: true })}` : 'No feed history yet'} · {nextDueText}</p>
        <div className="suggestion"><span>Suggested next: {sideLabel(suggestedSide)}</span></div>
        <div className="timer">{formatDuration(activeSeconds)}</div>
        {session ? (
          <div className="live-split" aria-label="Live split">
            <div className="split-title">Live split</div>
            <div><span>Left</span><strong>{formatDuration(activeSplit.left)}</strong></div>
            <div><span>Right</span><strong>{formatDuration(activeSplit.right)}</strong></div>
            <div><span>Bottle</span><strong>{session.bottleOunces.toFixed(1)} oz</strong></div>
          </div>
        ) : null}
        <div className="row hero-actions">
          {!session ? (<><button className="primary jumbo" aria-label={`Start suggested side: ${sideLabel(suggestedSide)}`} onClick={() => startSession(suggestedSide)}>Start {sideLabel(suggestedSide)}</button><button onClick={() => startSession(oppositeSide(suggestedSide))}>Start {sideLabel(oppositeSide(suggestedSide))}</button><button aria-label="Log bottle-only feed" onClick={() => setBottleOpen(true)}><Baby size={16} /> Bottle</button><button onClick={() => setManualOpen(true)}>Add missed feed</button></>) : (<>{activeSide ? (<><button className="primary" onClick={() => switchSide(activeOppositeSide)}>Switch to {sideLabel(activeOppositeSide)}</button><button onClick={pause}>Pause</button></>) : (<><button className="primary" onClick={() => resume(suggestedSide)}>Resume {sideLabel(suggestedSide)}</button><button onClick={() => resume(oppositeSide(suggestedSide))}>Resume {sideLabel(oppositeSide(suggestedSide))}</button></>)}<button aria-label="Add bottle to this feed" onClick={() => setBottleOpen(true)}><Baby size={16} /> Bottle</button><button className="danger end-feed" type="button" aria-label="End feed" onClick={endSession}><CirclePause size={16} /> Stop & Save Feed</button><button className="subtle-danger" type="button" aria-label="Clear active feed" onClick={clearSession}><XCircle size={16} /> Clear active</button></>)}
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
            <div className="row"><button aria-label="Export JSON" onClick={() => { const payload = { version: 1, exportedAt: new Date().toISOString(), entries }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `feeding-tracker-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); showToast('Data exported') }}><Download size={16} /> Export JSON</button><button aria-label="Import JSON" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import JSON</button><button className="danger" onClick={() => { if (!window.confirm('Clear all feeding data? Export a backup first if needed.')) return; setEntries([]); setSession(null); setUndoState(null); showToast('All data cleared') }}><Trash2 size={16} /> Clear all data</button></div>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const text = await file.text(); try { const parsed = JSON.parse(text) as { entries?: Entry[] }; if (!parsed.entries) throw new Error('Invalid data'); setEntries(parsed.entries.sort((a, b) => b.endedAt - a.endedAt)); showToast('Data imported') } catch { showToast('Import failed: invalid file') } finally { event.target.value = '' } }} />
          </section>
        </div>
      ) : null}

      <section className="card"><h2>Timeline</h2>{entries.length === 0 ? <p className="muted">No feeds yet. Start with left/right or quick bottle.</p> : <ul className="timeline">{entries.map((e) => { const isEditing = editing?.id === e.id; return <li key={e.id}><div className="timeline-head"><strong>{formatTime(e.startedAt)}</strong><span className={`badge badge-${e.type}`}>{e.type}</span><span className="muted">{formatDistanceToNow(e.endedAt, { addSuffix: true })}</span></div><div className="muted">{formatDuration(e.leftSeconds + e.rightSeconds)} · L {formatDuration(e.leftSeconds)} / R {formatDuration(e.rightSeconds)} {e.bottleOunces ? `· ${e.bottleOunces.toFixed(1)} oz` : ''}</div>{e.note ? <div className="note-chip">📝 {e.note}</div> : null}{isEditing ? <div className="edit-panel"><div className="manual-grid compact"><label>Left minutes<input inputMode="decimal" value={editing.leftMinutes} onChange={(v) => setEditing({ ...editing, leftMinutes: v.target.value })} placeholder="0" /></label><label>Right minutes<input inputMode="decimal" value={editing.rightMinutes} onChange={(v) => setEditing({ ...editing, rightMinutes: v.target.value })} placeholder="0" /></label><label>Ounces<input inputMode="decimal" value={editing.bottleOunces} onChange={(v) => setEditing({ ...editing, bottleOunces: v.target.value })} placeholder="e.g. 2.5" /></label><label>Note<input value={editing.note} onChange={(v) => setEditing({ ...editing, note: v.target.value })} placeholder="optional" /></label></div><div className="row"><button className="primary" aria-label="Save entry" onClick={() => { const nextLeft = Math.max(0, Math.round((Number(editing.leftMinutes) || 0) * 60)); const nextRight = Math.max(0, Math.round((Number(editing.rightMinutes) || 0) * 60)); const nextOz = editing.bottleOunces.trim() ? Number(editing.bottleOunces) : null; const safeOz = Number.isFinite(nextOz) && nextOz !== null && nextOz > 0 ? nextOz : null; const nextType: FeedType = safeOz && nextLeft + nextRight > 0 ? 'mixed' : safeOz ? 'bottle' : 'breast'; setEntries((prev) => prev.map((x) => x.id === editing.id ? { ...x, type: nextType, leftSeconds: nextLeft, rightSeconds: nextRight, bottleOunces: safeOz, note: editing.note.trim() } : x)); setEditing(null); showToast('Entry updated') }}><Save size={16} /> Save</button><button onClick={() => setEditing(null)}>Cancel</button></div></div> : <div className="row actions"><button aria-label="Resume session" onClick={() => resumeEntry(e)}><RotateCcw size={16} /> Resume</button><button aria-label="Edit entry" onClick={() => setEditing({ id: e.id, leftMinutes: String(Math.round(e.leftSeconds / 60)), rightMinutes: String(Math.round(e.rightSeconds / 60)), bottleOunces: e.bottleOunces ? e.bottleOunces.toFixed(1) : '', note: e.note ?? '' })}><Pencil size={16} /> Edit</button><button className="danger" aria-label="Delete entry" onClick={() => { if (undoState) window.clearTimeout(undoState.timeoutId); setEntries((prev) => prev.filter((x) => x.id !== e.id)); const timeoutId = window.setTimeout(() => setUndoState(null), 5000); setUndoState({ entry: e, timeoutId, kind: 'delete' }); setToast('Entry deleted') }}><Trash2 size={16} /> Delete</button></div>}</li> })}</ul>}</section>

      {(toast || undoState) && <div className="toast"><span>{toast || (undoState?.kind === 'resume' ? 'Session resumed' : 'Entry deleted')}</span>{undoState && <button aria-label={undoState.kind === 'resume' ? 'Undo resume' : 'Undo delete'} onClick={() => { if (!undoState) return; window.clearTimeout(undoState.timeoutId); setEntries((prev) => [undoState.entry, ...prev].sort((a, b) => b.endedAt - a.endedAt)); if (undoState.kind === 'resume') setSession(undoState.previousSession ?? null); setUndoState(null); showToast(undoState.kind === 'resume' ? 'Resume undone' : 'Deletion undone') }}><RotateCcw size={15} /> Undo</button>}</div>}
    </main>
  )
}

export default App
