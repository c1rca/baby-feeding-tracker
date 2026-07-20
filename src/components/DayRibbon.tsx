import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { MoonStar, Sparkles, Sun, X } from 'lucide-react'
import type { DayRhythm } from '../domain/dayRhythm'

const clockTime = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const durationText = (start: number, end: number) => {
  const minutes = Math.max(1, Math.round((end - start) / 60_000))
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours} hr${hours === 1 ? '' : 's'}${remainder ? ` ${remainder} min` : ''}` : `${minutes} min`
}
const feedTitle = { breast: 'Nursing', bottle: 'Bottle', mixed: 'Nursing + bottle' } as const
const diaperTitle = { wet: 'Wet diaper', stool: 'Stool diaper', mixed: 'Wet + stool diaper' } as const
const spanTitle = { sleep: 'Sleep', tummy: 'Tummy time' } as const

type Detail = { id: string; title: string; eyebrow: string; time: string; duration?: string; anchor: string; tone: string; atMs: number }

function rhythmDetails(rhythm: DayRhythm): Detail[] {
  const { dayStartMs, dayEndMs } = rhythm
  const dayMs = dayEndMs - dayStartMs
  const pct = (at: number) => `${(((at - dayStartMs) / dayMs) * 100).toFixed(2)}%`
  return [
    ...rhythm.spans.map((span) => ({ id: span.id, title: spanTitle[span.kind], eyebrow: 'Care session', time: `${clockTime(span.startMs)} to ${clockTime(span.endMs)}`, duration: durationText(span.startMs, span.endMs), anchor: pct(span.startMs + (span.endMs - span.startMs) / 2), tone: span.kind, atMs: span.startMs })),
    ...rhythm.feeds.map((feed) => ({ id: feed.id, title: feedTitle[feed.type], eyebrow: 'Feed', time: `${clockTime(feed.atMs)} to ${clockTime(feed.endMs)}`, duration: durationText(feed.atMs, feed.endMs), anchor: pct(feed.atMs), tone: feed.type, atMs: feed.atMs })),
    ...rhythm.diapers.map((diaper) => ({ id: diaper.id, title: diaperTitle[diaper.kind], eyebrow: 'Diaper change', time: clockTime(diaper.atMs), anchor: pct(diaper.atMs), tone: `diaper-${diaper.kind}`, atMs: diaper.atMs })),
  ].sort((a, b) => a.atMs - b.atMs)
}

function pointEventRows(events: { id: string; atMs: number }[]) {
  const lastAtByRow = [-Infinity, -Infinity, -Infinity]
  return new Map(events.slice().sort((a, b) => a.atMs - b.atMs).map((event) => {
    const row = lastAtByRow.findIndex((lastAt) => event.atMs - lastAt >= 45 * 60_000)
    const assignedRow = row === -1 ? lastAtByRow.indexOf(Math.min(...lastAtByRow)) : row
    lastAtByRow[assignedRow] = event.atMs
    return [event.id, assignedRow] as const
  }))
}

function ExpandedRhythm({ rhythm, onClose }: { rhythm: DayRhythm; onClose: () => void }) {
  const [selected, setSelected] = useState<Detail | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const details = useMemo(() => rhythmDetails(rhythm), [rhythm])
  const pointRows = useMemo(() => pointEventRows([...rhythm.feeds, ...rhythm.diapers]), [rhythm.diapers, rhythm.feeds])
  const { dayStartMs, dayEndMs, nowMs, feeds, diapers, spans } = rhythm
  const dayMs = dayEndMs - dayStartMs
  const pct = (at: number) => `${(((at - dayStartMs) / dayMs) * 100).toFixed(2)}%`
  const widthPct = (start: number, end: number) => `${(Math.max(end - start, 0) / dayMs * 100).toFixed(2)}%`
  const sleepMinutes = spans.filter((span) => span.kind === 'sleep').reduce((sum, span) => sum + Math.max(0, span.endMs - span.startMs), 0)
  const sleepText = sleepMinutes ? durationText(0, sleepMinutes) : 'No sleep yet'
  const diaperCounts = diapers.reduce((counts, diaper) => ({ ...counts, [diaper.kind]: counts[diaper.kind] + 1 }), { wet: 0, stool: 0, mixed: 0 })
  const diaperSummary = `${diapers.length} ${diapers.length === 1 ? 'diaper' : 'diapers'}, ${diaperCounts.wet} wet, ${diaperCounts.stool} stool, ${diaperCounts.mixed} mixed`
  const date = new Date(dayStartMs).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const dialog = closeRef.current?.closest('[role="dialog"]')
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [onClose])

  return createPortal(
    <div className="rhythm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="rhythm-modal" role="dialog" aria-modal="true" aria-label="Today's rhythm">
        <div className="rhythm-aurora" aria-hidden="true"><i /><i /><i /></div>
        <header className="rhythm-modal-header">
          <div>
            <span className="rhythm-modal-date"><Sun size={14} /> {date}</span>
            <h2>Your day, in motion</h2>
            <p>Every feed, change, rest, and little moment in one living view.</p>
          </div>
          <button ref={closeRef} type="button" className="rhythm-modal-close" aria-label="Close expanded rhythm" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="rhythm-vitals" aria-label="Today's rhythm highlights">
          <div><span>Feeds</span><strong>{feeds.length}</strong><small>{feeds.length === 1 ? '1 feed' : `${feeds.length} feeds`}</small></div>
          <div className="rhythm-vital rhythm-vital--changes" aria-label={`Changes: ${diaperSummary}`}>
            <span>Changes</span><strong>{diapers.length}</strong>
            <div className="rhythm-diaper-breakdown" aria-hidden="true">
              <span className="rhythm-diaper-count rhythm-diaper-count--wet">Wet <b>{diaperCounts.wet}</b></span>
              <span className="rhythm-diaper-count rhythm-diaper-count--stool">Stool <b>{diaperCounts.stool}</b></span>
              <span className="rhythm-diaper-count rhythm-diaper-count--mixed">Mixed <b>{diaperCounts.mixed}</b></span>
            </div>
          </div>
          <div><span>Rest</span><strong><MoonStar size={22} /></strong><small>{sleepText}</small></div>
          <div><span>Moments</span><strong>{details.length}</strong><small>logged today</small></div>
        </div>

        <div className="rhythm-stage">
          <div className="rhythm-stage-sky" aria-hidden="true"><Sun size={18} /><span /><MoonStar size={18} /></div>
          <div className="rhythm-stage-track" role="group" aria-label={`Expanded timeline: ${rhythm.summary}`}>
            <div className="rhythm-stage-lane rhythm-stage-lane--rest"><span>Rest & play</span></div>
            <div className="rhythm-stage-lane rhythm-stage-lane--care"><span>Feeds & care</span></div>
            {spans.map((span) => {
              const detail = details.find((item) => item.id === span.id)!
              return <button type="button" key={span.id} className={`rhythm-stage-span rhythm-stage-span--${span.kind}`} style={{ left: pct(span.startMs), width: widthPct(span.startMs, span.endMs) }} aria-label={`${detail.title} from ${detail.time}, ${detail.duration}`} aria-pressed={selected?.id === detail.id} onClick={() => setSelected(detail)}><span>{detail.title}</span></button>
            })}
            {feeds.map((feed) => {
              const detail = details.find((item) => item.id === feed.id)!
              return <button type="button" key={feed.id} className={`rhythm-stage-event rhythm-stage-event--${feed.type}`} style={{ left: pct(feed.atMs), '--rhythm-event-row': pointRows.get(feed.id) ?? 0 } as CSSProperties} aria-label={`${detail.title} at ${clockTime(feed.atMs)}, ${detail.duration}`} aria-pressed={selected?.id === detail.id} onClick={() => setSelected(detail)}><i /></button>
            })}
            {diapers.map((diaper) => {
              const detail = details.find((item) => item.id === diaper.id)!
              return <button type="button" key={diaper.id} className={`rhythm-stage-diaper rhythm-stage-diaper--${diaper.kind}`} style={{ left: pct(diaper.atMs), '--rhythm-event-row': pointRows.get(diaper.id) ?? 0 } as CSSProperties} aria-label={`${detail.title} at ${detail.time}`} aria-pressed={selected?.id === detail.id} onClick={() => setSelected(detail)}><i /></button>
            })}
            <span className="rhythm-stage-now" style={{ left: pct(nowMs) }} aria-hidden="true"><i>Now</i></span>
          </div>
          <div className="rhythm-stage-hours" aria-hidden="true"><span>Midnight</span><span>6 AM</span><span>Noon</span><span>6 PM</span><span>Midnight</span></div>
        </div>

        <div className={`rhythm-focus rhythm-focus--${selected?.tone ?? 'idle'}`} role="status" aria-live="polite">
          {selected ? <><span>{selected.eyebrow}</span><strong>{selected.title}</strong><time>{selected.time}</time>{selected.duration ? <b>{selected.duration}</b> : null}</> : <><Sparkles size={18} /><strong>Touch any moment</strong><span>The day will tell you its story.</span></>}
        </div>

        <div className="rhythm-modal-legend" aria-label="Timeline legend"><span className="legend-breast">Nursing</span><span className="legend-bottle">Bottle</span><span className="legend-diaper">Diaper</span><span className="legend-sleep">Sleep</span><span className="legend-tummy">Tummy</span></div>
      </section>
    </div>, document.body)
}

export function DayRibbon({ rhythm }: { rhythm: DayRhythm }) {
  const { dayStartMs, dayEndMs, nowMs, feeds, diapers, spans, summary } = rhythm
  const [active, setActive] = useState<Detail | null>(null)
  const [pinned, setPinned] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const details = useMemo(() => rhythmDetails(rhythm), [rhythm])
  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return
      setActive(null); setPinned(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [])
  const dayMs = dayEndMs - dayStartMs
  const pct = (at: number) => `${(((at - dayStartMs) / dayMs) * 100).toFixed(2)}%`
  const widthPct = (start: number, end: number) => `${(Math.max(end - start, 0) / dayMs * 100).toFixed(2)}%`
  const isEmpty = feeds.length === 0 && diapers.length === 0 && spans.length === 0
  const show = (detail: Detail, pin = false) => { setActive(detail); setPinned(pin) }
  const toggle = (detail: Detail) => { const closing = pinned && active?.id === detail.id; setActive(closing ? null : detail); setPinned(!closing) }
  const leave = () => { if (!pinned) setActive(null) }
  const openExpanded = () => { setActive(null); setPinned(false); setExpanded(true) }
  const closeExpanded = () => { timelineRef.current?.focus(); setExpanded(false) }
  const openFromKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    openExpanded()
  }
  const inspect = (event: MouseEvent, detail: Detail) => { event.stopPropagation(); toggle(detail) }

  return (
    <section ref={cardRef} className="card day-ribbon-card">
      <div className="section-heading"><h2>Today's rhythm</h2><span className="muted">{isEmpty ? 'a fresh day' : summary}</span></div>
      <div ref={timelineRef} className="day-ribbon" role="group" tabIndex={0} aria-label={isEmpty ? "Today's rhythm: nothing logged yet" : `Today's rhythm: ${summary}`} onMouseLeave={leave} onClick={openExpanded} onKeyDown={openFromKeyboard}>
        <div className="day-ribbon-track">
          {spans.map((span) => {
            const detail = details.find((item) => item.id === span.id)!
            return <button type="button" key={span.id} className={`day-ribbon-span day-ribbon-span--${span.kind}`} style={{ left: pct(span.startMs), width: widthPct(span.startMs, span.endMs) }} aria-label={`${detail.title} from ${detail.time}, ${detail.duration}`} aria-expanded={active?.id === span.id} onMouseEnter={() => show(detail)} onFocus={() => show(detail)} onBlur={leave} onClick={(event) => inspect(event, detail)} />
          })}
          {feeds.map((feed) => {
            const detail = details.find((item) => item.id === feed.id)!
            return <button type="button" key={feed.id} className={`day-ribbon-feed day-ribbon-feed--${feed.type}`} style={{ left: pct(feed.atMs) }} aria-label={`${detail.title} at ${clockTime(feed.atMs)}, ${detail.duration}`} aria-expanded={active?.id === feed.id} onMouseEnter={() => show(detail)} onFocus={() => show(detail)} onBlur={leave} onClick={(event) => inspect(event, detail)} />
          })}
          {diapers.map((diaper) => {
            const detail = details.find((item) => item.id === diaper.id)!
            return <button type="button" key={diaper.id} className={`day-ribbon-tick day-ribbon-tick--${diaper.kind}`} style={{ left: pct(diaper.atMs) }} aria-label={`${detail.title} at ${detail.time}`} aria-expanded={active?.id === diaper.id} onMouseEnter={() => show(detail)} onFocus={() => show(detail)} onBlur={leave} onClick={(event) => inspect(event, detail)} />
          })}
          <span className="day-ribbon-now" style={{ left: pct(nowMs) }} aria-hidden="true" />
          {active ? <div className={`day-ribbon-tooltip day-ribbon-tooltip--${active.tone}`} style={{ '--rhythm-anchor': active.anchor } as CSSProperties} role="tooltip"><span>{active.eyebrow}</span><strong>{active.title}</strong><div><time>{active.time}</time>{active.duration ? <b>{active.duration}</b> : null}</div><i aria-hidden="true" /></div> : null}
        </div>
        <div className="day-ribbon-hours" aria-hidden="true"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>
      </div>
      <div className="day-ribbon-legend" aria-hidden="true"><span className="day-ribbon-legend-item legend-breast">Nursing</span><span className="day-ribbon-legend-item legend-bottle">Bottle</span><span className="day-ribbon-legend-item legend-diaper">Diaper</span><span className="day-ribbon-legend-item legend-sleep">Sleep</span><span className="day-ribbon-legend-item legend-tummy">Tummy</span></div>
      {expanded ? <ExpandedRhythm rhythm={rhythm} onClose={closeExpanded} /> : null}
    </section>
  )
}
