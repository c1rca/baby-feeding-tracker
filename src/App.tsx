import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
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
}
type Session = {
  startedAt: number
  activeSide: Side | null
  segmentStart: number | null
  segments: Segment[]
  bottleOunces: number
}

const KEY_ENTRIES = 'baby-feeding-tracker:v1:entries'
const KEY_SESSION = 'baby-feeding-tracker:v1:session'


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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => localStorage.setItem(KEY_ENTRIES, JSON.stringify(entries)), [entries])
  useEffect(() => localStorage.setItem(KEY_SESSION, JSON.stringify(session)), [session])

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
    }
    setEntries((prev) => [entry, ...prev])
    setSession(null)
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
    }
    setEntries((prev) => [entry, ...prev])
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

  const lastFeed = entries[0]

  return (
    <main className="app">
      <header className="top"><h1>Baby Feeding Tracker</h1><p>Fast, one-hand feeding logs</p></header>

      <section className="card hero">
        <h2>Active Feed</h2>
        <div className="timer">{formatDuration(activeSeconds)}</div>
        <div className="row">
          {!session && (
            <>
              <button onClick={() => startSession('left')}>Start Left</button>
              <button onClick={() => startSession('right')}>Start Right</button>
            </>
          )}
          {session && (
            <>
              {session.activeSide ? (
                <>
                  <button onClick={() => switchSide(session.activeSide === 'left' ? 'right' : 'left')}>Switch to {session.activeSide === 'left' ? 'Right' : 'Left'}</button>
                  <button onClick={pause}>Pause</button>
                </>
              ) : (
                <>
                  <button onClick={() => resume('left')}>Resume Left</button>
                  <button onClick={() => resume('right')}>Resume Right</button>
                </>
              )}
              <button className="danger" onClick={endSession}>End Feed</button>
            </>
          )}
        </div>
        {session && (
          <div className="row">
            <span>Add bottle to this feed:</span>
            <button onClick={() => setSession({ ...session, bottleOunces: Math.max(0, +(session.bottleOunces - 0.5).toFixed(1)) })}>-0.5</button>
            <strong>{session.bottleOunces.toFixed(1)} oz</strong>
            <button onClick={() => setSession({ ...session, bottleOunces: +(session.bottleOunces + 0.5).toFixed(1) })}>+0.5</button>
          </div>
        )}
      </section>

      <section className="grid">
        <div className="card"><h3>Feeds today</h3><p>{today.count}</p></div>
        <div className="card"><h3>Nursing</h3><p>{formatDuration(today.nursing)}</p></div>
        <div className="card"><h3>Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div>
        <div className="card"><h3>L/R split</h3><p>{formatDuration(today.left)} / {formatDuration(today.right)}</p></div>
      </section>

      <section className="card">
        <h2>Quick Bottle Log</h2>
        <div className="row">
          <button onClick={() => setBottleQuickOz((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}>-0.5</button>
          <strong>{bottleQuickOz.toFixed(1)} oz</strong>
          <button onClick={() => setBottleQuickOz((v) => +(v + 0.5).toFixed(1))}>+0.5</button>
          <button onClick={logBottle}>Log bottle</button>
        </div>
      </section>

      <section className="card">
        <h2>Timeline</h2>
        {lastFeed && <p className="muted">Last feed {formatDistanceToNow(lastFeed.endedAt, { addSuffix: true })}</p>}
        {entries.length === 0 ? <p className="muted">No feeds yet today. Start with Left, Right, or Bottle.</p> : (
          <ul className="timeline">
            {entries.map((e) => (
              <li key={e.id}>
                <div><strong>{new Date(e.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong> · <span className="badge">{e.type}</span></div>
                <div className="muted">{formatDuration(e.leftSeconds + e.rightSeconds)} · L {formatDuration(e.leftSeconds)} / R {formatDuration(e.rightSeconds)} {e.bottleOunces ? `· ${e.bottleOunces.toFixed(1)} oz` : ''}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
