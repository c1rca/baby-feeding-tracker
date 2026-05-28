import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Baby, CirclePause, Download, Pencil, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
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
type Session = {
  startedAt: number
  activeSide: Side | null
  segmentStart: number | null
  segments: Segment[]
  bottleOunces: number
}
type UndoState = { entry: Entry; timeoutId: number }

type EditingState = { id: string; bottleOunces: string; note: string } | null

const KEY_ENTRIES = 'baby-feeding-tracker:v1:entries'
const KEY_SESSION = 'baby-feeding-tracker:v1:session'

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function App() {
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const saved = localStorage.getItem(KEY_ENTRIES)
      const parsed = saved ? (JSON.parse(saved) as Entry[]) : []
      return parsed.sort((a, b) => b.endedAt - a.endedAt)
    } catch {
      return []
    }
  })
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const saved = localStorage.getItem(KEY_SESSION)
      return saved ? (JSON.parse(saved) as Session) : null
    } catch {
      return null
    }
  })
  const [bottleQuickOz, setBottleQuickOz] = useState(2)
  const [now, setNow] = useState(0)
  const [toast, setToast] = useState('')
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [editing, setEditing] = useState<EditingState>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries)), [entries])
  useEffect(() => localStorage.setItem(KEY_SESSION, JSON.stringify(session)), [session])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  const startSession = (side: Side) => {
    const t = Date.now()
    setSession({ startedAt: t, activeSide: side, segmentStart: t, segments: [], bottleOunces: 0 })
  }

  const switchSide = (side: Side) => {
    if (!session || !session.activeSide || !session.segmentStart) return
    const t = Date.now()
    setSession({
      ...session,
      segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }],
      activeSide: side,
      segmentStart: t,
    })
  }

  const pause = () => {
    if (!session || !session.activeSide || !session.segmentStart) return
    const t = Date.now()
    setSession({
      ...session,
      segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }],
      activeSide: null,
      segmentStart: null,
    })
  }

  const resume = (side: Side) => {
    if (!session) return
    setSession({ ...session, activeSide: side, segmentStart: Date.now() })
  }

  const endSession = () => {
    if (!session) return
    const t = Date.now()
    const finished: Segment[] = [...session.segments]
    if (session.activeSide && session.segmentStart) {
      finished.push({ side: session.activeSide, startedAt: session.segmentStart, endedAt: t })
    }
    const { left, right } = sumSideDurations(finished)
    const bottle = session.bottleOunces > 0 ? session.bottleOunces : null
    const type: FeedType = bottle && left + right > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
    const entry: Entry = {
      id: crypto.randomUUID(),
      type,
      startedAt: session.startedAt,
      endedAt: t,
      leftSeconds: left,
      rightSeconds: right,
      bottleOunces: bottle,
      note: '',
    }
    setEntries((prev) => [entry, ...prev])
    setSession(null)
    showToast('Feed saved')
  }

  const logBottle = () => {
    const t = Date.now()
    const entry: Entry = {
      id: crypto.randomUUID(),
      type: 'bottle',
      startedAt: t,
      endedAt: t,
      leftSeconds: 0,
      rightSeconds: 0,
      bottleOunces: bottleQuickOz,
      note: '',
    }
    setEntries((prev) => [entry, ...prev])
    showToast('Bottle feed saved')
  }

  const deleteEntry = (entry: Entry) => {
    if (undoState) {
      window.clearTimeout(undoState.timeoutId)
    }
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ entry, timeoutId })
    setToast('Entry deleted')
  }

  const undoDelete = () => {
    if (!undoState) return
    window.clearTimeout(undoState.timeoutId)
    setEntries((prev) => [undoState.entry, ...prev].sort((a, b) => b.endedAt - a.endedAt))
    setUndoState(null)
    showToast('Deletion undone')
  }

  const beginEdit = (entry: Entry) => {
    setEditing({ id: entry.id, bottleOunces: entry.bottleOunces ? entry.bottleOunces.toFixed(1) : '', note: entry.note ?? '' })
  }

  const saveEdit = () => {
    if (!editing) return
    const nextOz = editing.bottleOunces.trim() ? Number(editing.bottleOunces) : null
    setEntries((prev) => prev.map((e) => (e.id === editing.id ? { ...e, bottleOunces: Number.isFinite(nextOz) && nextOz !== null ? nextOz : null, note: editing.note.trim() } : e)))
    setEditing(null)
    showToast('Entry updated')
  }

  const exportData = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `feeding-tracker-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Data exported')
  }

  const importData: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = JSON.parse(text) as { entries?: Entry[] }
      if (!parsed.entries) throw new Error('Invalid data')
      setEntries(parsed.entries.sort((a, b) => b.endedAt - a.endedAt))
      showToast('Data imported')
    } catch {
      showToast('Import failed: invalid file')
    } finally {
      event.target.value = ''
    }
  }

  const clearAllData = () => {
    setEntries([])
    setSession(null)
    setUndoState(null)
    showToast('All data cleared')
  }

  const activeSeconds = useMemo(() => {
    if (!session) return 0
    const draft = [...session.segments]
    if (session.activeSide && session.segmentStart) {
      draft.push({ side: session.activeSide, startedAt: session.segmentStart, endedAt: now })
    }
    const { left, right } = sumSideDurations(draft)
    return left + right
  }, [session, now])

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const list = entries.filter((e) => e.endedAt >= start.getTime())
    const nursing = list.reduce((a, e) => a + e.leftSeconds + e.rightSeconds, 0)
    const left = list.reduce((a, e) => a + e.leftSeconds, 0)
    const right = list.reduce((a, e) => a + e.rightSeconds, 0)
    const oz = list.reduce((a, e) => a + (e.bottleOunces ?? 0), 0)
    return { count: list.length, nursing, left, right, oz }
  }, [entries])

  return (
    <main className="app">
      <header className="top">
        <h1><Baby size={20} /> Baby Feeding Tracker</h1>
        <p>Beautiful, one-hand logging designed for speed</p>
      </header>

      <section className="card hero">
        <div className="hero-top"><h2>Active Feed</h2><span className="pill">{session?.activeSide ? `On ${session.activeSide}` : session ? 'Paused' : 'Ready'}</span></div>
        <div className="timer">{formatDuration(activeSeconds)}</div>
        <div className="row">
          {!session ? (<><button className="primary" onClick={() => startSession('left')}>Start Left</button><button className="primary" onClick={() => startSession('right')}>Start Right</button></>) : (
            <>
              {session.activeSide ? (<><button onClick={() => switchSide(session.activeSide === 'left' ? 'right' : 'left')}>Switch to {session.activeSide === 'left' ? 'Right' : 'Left'}</button><button onClick={pause}>Pause</button></>) : (<><button onClick={() => resume('left')}>Resume Left</button><button onClick={() => resume('right')}>Resume Right</button></>)}
              <button className="danger" aria-label="End feed" onClick={endSession}><CirclePause size={16} /> End Feed</button>
            </>
          )}
        </div>
        {session && <div className="row"><span className="muted">Bottle add-on:</span><button onClick={() => setSession({ ...session, bottleOunces: Math.max(0, +(session.bottleOunces - 0.5).toFixed(1)) })}>-0.5</button><strong>{session.bottleOunces.toFixed(1)} oz</strong><button onClick={() => setSession({ ...session, bottleOunces: +(session.bottleOunces + 0.5).toFixed(1) })}>+0.5</button></div>}
      </section>

      <section className="grid">
        <div className="card stat"><h3>Feeds today</h3><p>{today.count}</p></div>
        <div className="card stat"><h3>Nursing</h3><p>{formatDuration(today.nursing)}</p></div>
        <div className="card stat"><h3>Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div>
        <div className="card stat"><h3>L / R split</h3><p>{formatDuration(today.left)} / {formatDuration(today.right)}</p></div>
      </section>

      <section className="card">
        <h2>Quick Bottle Log</h2>
        <div className="row">
          <button onClick={() => setBottleQuickOz((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}>-0.5</button>
          <strong>{bottleQuickOz.toFixed(1)} oz</strong>
          <button onClick={() => setBottleQuickOz((v) => +(v + 0.5).toFixed(1))}>+0.5</button>
          <button className="primary" aria-label="Log bottle" onClick={logBottle}><Baby size={16} /> Log bottle</button>
        </div>
      </section>

      <section className="card settings">
        <h2>Settings & Data</h2>
        <div className="row"><button aria-label="Export JSON" onClick={exportData}><Download size={16} /> Export JSON</button><button aria-label="Import JSON" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import JSON</button><button className="danger" onClick={clearAllData}><Trash2 size={16} /> Clear all data</button></div>
        <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={importData} />
      </section>

      <section className="card">
        <h2>Timeline</h2>
        {entries.length === 0 ? <p className="muted">No feeds yet. Start with left/right or quick bottle.</p> : (
          <ul className="timeline">
            {entries.map((e) => {
              const isEditing = editing?.id === e.id
              return (
                <li key={e.id}>
                  <div className="timeline-head"><strong>{formatTime(e.startedAt)}</strong><span className={`badge badge-${e.type}`}>{e.type}</span><span className="muted">{formatDistanceToNow(e.endedAt, { addSuffix: true })}</span></div>
                  <div className="muted">{formatDuration(e.leftSeconds + e.rightSeconds)} · L {formatDuration(e.leftSeconds)} / R {formatDuration(e.rightSeconds)} {e.bottleOunces ? `· ${e.bottleOunces.toFixed(1)} oz` : ''}</div>
                  {isEditing ? (
                    <div className="edit-panel">
                      <label>Ounces<input value={editing.bottleOunces} onChange={(v) => setEditing({ ...editing, bottleOunces: v.target.value })} placeholder="e.g. 2.5" /></label>
                      <label>Note<input value={editing.note} onChange={(v) => setEditing({ ...editing, note: v.target.value })} placeholder="optional" /></label>
                      <div className="row"><button className="primary" aria-label="Save entry" onClick={saveEdit}><Save size={16} /> Save</button><button onClick={() => setEditing(null)}>Cancel</button></div>
                    </div>
                  ) : (
                    <div className="row actions"><button aria-label="Edit entry" onClick={() => beginEdit(e)}><Pencil size={16} /> Edit</button><button className="danger" aria-label="Delete entry" onClick={() => deleteEntry(e)}><Trash2 size={16} /> Delete</button></div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {(toast || undoState) && (
        <div className="toast">
          <span>{toast || 'Entry deleted'}</span>
          {undoState && <button aria-label="Undo delete" onClick={undoDelete}><RotateCcw size={15} /> Undo</button>}
        </div>
      )}
    </main>
  )
}

export default App
