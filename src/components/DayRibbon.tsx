import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, MoonStar, Sparkles, Sun, X } from 'lucide-react'
import type { DayRhythm } from '../domain/dayRhythm'
import { addLocalDays, formatDateInput, startOfLocalDay } from '../domain/time'
import { customTrackerHueToken } from '../domain/customTrackers'
import { CustomTrackerIcon } from './customTrackerIcons'

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

// The eyebrow beside the picker already carries the full date, so the control
// itself says how far back you are — that is what a caregiver actually thinks in.
const relativeDayLabel = (dayStartMs: number, todayStartMs: number) => {
  const daysBack = Math.round((todayStartMs - dayStartMs) / (24 * 60 * 60 * 1000))
  if (daysBack <= 0) return 'Today'
  if (daysBack === 1) return 'Yesterday'
  return `${daysBack} days ago`
}
const dayOf = (dayStartMs: number, delta: number) => addLocalDays(startOfLocalDay(dayStartMs), delta).getTime()
const parseDayInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : null
}

function RhythmDayPicker({ dayStartMs, todayStartMs, earliestDayMs, fullDate, onPick }: { dayStartMs: number; todayStartMs: number; earliestDayMs: number | null; fullDate: string; onPick: (dayStartMs: number) => void }) {
  const minDayMs = Math.min(earliestDayMs ?? todayStartMs, todayStartMs, dayStartMs)
  const canGoBack = dayStartMs > minDayMs
  const canGoForward = dayStartMs < todayStartMs
  const clamp = (candidate: number) => Math.min(Math.max(candidate, minDayMs), todayStartMs)
  const step = (delta: number) => onPick(clamp(dayOf(dayStartMs, delta)))
  return (
    <div className="rhythm-daynav" role="group" aria-label="Choose a day">
      <button type="button" className="rhythm-daynav-step" aria-label="Previous day" disabled={!canGoBack} onClick={() => step(-1)}><ChevronLeft size={18} /></button>
      <label className="rhythm-daynav-field">
        <CalendarDays size={15} aria-hidden="true" />
        <b aria-hidden="true">{relativeDayLabel(dayStartMs, todayStartMs)}</b>
        {/* The native input sits invisibly over the label so the platform date
            picker (and its keyboard editing) stays intact while the control
            matches the modal. Chrome only opens the calendar from the indicator,
            so nudge it open on click where showPicker exists. */}
        <input
          type="date"
          aria-label={`Day shown: ${fullDate}. Choose a different day`}
          value={formatDateInput(dayStartMs)}
          min={formatDateInput(minDayMs)}
          max={formatDateInput(todayStartMs)}
          onClick={(event) => { try { event.currentTarget.showPicker?.() } catch { /* unsupported or not user-activated */ } }}
          onChange={(event) => { const picked = parseDayInput(event.target.value); if (picked !== null) onPick(clamp(picked)) }}
        />
      </label>
      <button type="button" className="rhythm-daynav-step" aria-label="Next day" disabled={!canGoForward} onClick={() => step(1)}><ChevronRight size={18} /></button>
      {canGoForward ? <button type="button" className="rhythm-daynav-today" onClick={() => onPick(todayStartMs)}>Today</button> : null}
    </div>
  )
}

function ExpandedRhythm({ rhythm, rhythmForDay, earliestDayMs = null, onClose }: { rhythm: DayRhythm; rhythmForDay?: (dayAnchorMs: number) => DayRhythm; earliestDayMs?: number | null; onClose: () => void }) {
  const [selected, setSelected] = useState<Detail | null>(null)
  const [pickedDayMs, setPickedDayMs] = useState(rhythm.dayStartMs)
  const closeRef = useRef<HTMLButtonElement>(null)
  const todayStartMs = rhythm.dayStartMs
  // Derived, not stored: if the day rolls over (or the clock shifts) while the
  // dialog is open, the picked day can never sit in the future.
  const viewDayMs = Math.min(pickedDayMs, todayStartMs)
  const isToday = viewDayMs === todayStartMs
  // `rhythm` is always today's; any other day is rebuilt from the same events.
  const view = isToday || !rhythmForDay ? rhythm : rhythmForDay(viewDayMs)
  const details = useMemo(() => rhythmDetails(view), [view])
  const pointRows = useMemo(() => pointEventRows([...view.feeds, ...view.diapers]), [view.diapers, view.feeds])
  const { dayStartMs, dayEndMs, nowMs, feeds, diapers, spans, recap } = view
  const dayMs = dayEndMs - dayStartMs
  const pct = (at: number) => `${(((at - dayStartMs) / dayMs) * 100).toFixed(2)}%`
  const widthPct = (start: number, end: number) => `${(Math.max(end - start, 0) / dayMs * 100).toFixed(2)}%`
  const sleepMinutes = spans.filter((span) => span.kind === 'sleep').reduce((sum, span) => sum + Math.max(0, span.endMs - span.startMs), 0)
  const sleepText = sleepMinutes ? durationText(0, sleepMinutes) : isToday ? 'No sleep yet' : 'No sleep logged'
  const feedSplit = feeds.reduce((split, feed) => ({ left: split.left + (feed.leftSeconds ?? 0), right: split.right + (feed.rightSeconds ?? 0) }), { left: 0, right: 0 })
  const feedDurationMs = feeds.reduce((total, feed) => total + Math.max(0, feed.endMs - feed.atMs), 0)
  const feedingTime = feedDurationMs > 0 ? durationText(0, feedDurationMs) : '0 min'
  const feedMinutes = { left: Math.round(feedSplit.left / 60), right: Math.round(feedSplit.right / 60) }
  const nursingSeconds = feedSplit.left + feedSplit.right
  const leftShare = nursingSeconds > 0 ? Math.round(feedSplit.left / nursingSeconds * 100) : 50
  const feedSummary = `${feeds.length} ${feeds.length === 1 ? 'feed' : 'feeds'}, ${feedingTime} total, ${feedMinutes.left} ${feedMinutes.left === 1 ? 'minute' : 'minutes'} left, ${feedMinutes.right} ${feedMinutes.right === 1 ? 'minute' : 'minutes'} right`
  const diaperCounts = diapers.reduce((counts, diaper) => ({ ...counts, [diaper.kind]: counts[diaper.kind] + 1 }), { wet: 0, stool: 0, mixed: 0 })
  const diaperSummary = `${diapers.length} total, ${diaperCounts.wet} wet, ${diaperCounts.stool} stool, ${diaperCounts.mixed} mixed`
  const date = new Date(dayStartMs).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  // Mount-only: `onClose` is a fresh closure on every clock tick, so taking the
  // opening focus here would re-steal it each second — which would fight anyone
  // editing the date field.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const dialog = closeRef.current?.closest('[role="dialog"]')
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div className="rhythm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="rhythm-modal" role="dialog" aria-modal="true" aria-label={isToday ? "Today's rhythm" : `Rhythm for ${date}`}>
        <div className="rhythm-aurora" aria-hidden="true"><i /><i /><i /></div>
        <header className="rhythm-modal-header">
          <div className="rhythm-modal-heading">
            <span className="rhythm-modal-date">{isToday ? <Sun size={14} /> : <CalendarDays size={14} />} {date}</span>
            <h2>Your day, in motion</h2>
            <p>Every feed, change, rest, and little moment in one living view.</p>
          </div>
          <div className="rhythm-modal-aside">
            {rhythmForDay ? <RhythmDayPicker dayStartMs={viewDayMs} todayStartMs={todayStartMs} earliestDayMs={earliestDayMs} fullDate={date} onPick={(nextDayMs) => { setSelected(null); setPickedDayMs(nextDayMs) }} /> : null}
            <button ref={closeRef} type="button" className="rhythm-modal-close" aria-label="Close expanded rhythm" onClick={onClose}><X size={20} /></button>
          </div>
        </header>

        <div className="rhythm-vitals" aria-label={isToday ? "Today's rhythm highlights" : `Rhythm highlights for ${date}`}>
          <section className="rhythm-insight rhythm-insight--feeding" aria-label={`Feeding: ${feedSummary}`}>
            <header className="rhythm-insight-head"><span>Feeding</span><b>{feeds.length} {feeds.length === 1 ? 'feed' : 'feeds'}</b></header>
            <div className="rhythm-feeding-total"><strong>{feedingTime}</strong><small>Feeding time</small></div>
            <div className="rhythm-side-stats">
              <div className="rhythm-side-stat rhythm-side-stat--left"><span>Left</span><strong>{feedMinutes.left}m</strong></div>
              <div className="rhythm-side-stat rhythm-side-stat--right"><span>Right</span><strong>{feedMinutes.right}m</strong></div>
            </div>
            <div className={`rhythm-side-balance${nursingSeconds === 0 ? ' is-empty' : ''}`} style={{ '--rhythm-left-share': `${leftShare}%` } as CSSProperties} aria-hidden="true"><i /><i /></div>
          </section>

          <section className="rhythm-insight rhythm-insight--changes" aria-label={`Changes: ${diaperSummary}`}>
            <header className="rhythm-insight-head"><span>Changes</span></header>
            <div className="rhythm-change-total"><strong>{diapers.length}</strong><small>Total changes</small></div>
            <div className="rhythm-change-stats">
              <div className="rhythm-change-stat rhythm-change-stat--wet"><span>Wet</span><strong>{diaperCounts.wet}</strong></div>
              <div className="rhythm-change-stat rhythm-change-stat--stool"><span>Stool</span><strong>{diaperCounts.stool}</strong></div>
              <div className="rhythm-change-stat rhythm-change-stat--mixed"><span>Mixed</span><strong>{diaperCounts.mixed}</strong></div>
            </div>
          </section>

          {/* Rest used to be a tile of its own beside a separate recap strip —
              two cards saying "here is how today went". Folded into one: the
              things a caregiver checks before the day ends, each already
              resolved to done or not so nobody compares a number to a goal in
              their head. */}
          <section className="rhythm-insight rhythm-insight--recap" aria-label={isToday ? 'Today so far' : `Recap for ${date}`}>
            <header className="rhythm-insight-head"><span>{isToday ? 'Today so far' : 'That day'}</span></header>
            <ul className="rhythm-recap-items">
              {recap.showSleep ? (
                <li className={`rhythm-recap-item${recap.sleepMinutes > 0 ? ' is-done' : ''}`}>
                  <span className="rhythm-recap-icon" aria-hidden="true"><MoonStar size={15} /></span>
                  <span className="rhythm-recap-text">
                    <strong>Rest</strong>
                    <small>{sleepText}</small>
                  </span>
                </li>
              ) : null}
              <li className={`rhythm-recap-item${recap.tummyGoalMet ? ' is-done' : ''}`}>
                <span className="rhythm-recap-icon" aria-hidden="true">{recap.tummyGoalMet ? <Check size={15} /> : <Dumbbell size={15} />}</span>
                <span className="rhythm-recap-text">
                  <strong>Tummy time</strong>
                  <small>{recap.tummyGoalMinutes > 0 ? (recap.tummyGoalMet ? `${recap.tummyMinutes}m — goal met` : `${recap.tummyMinutes} of ${recap.tummyGoalMinutes}m`) : `${recap.tummyMinutes}m · no goal set`}</small>
                </span>
              </li>
              <li className={`rhythm-recap-item${recap.vitaminDAtMs ? ' is-done' : ''}`}>
                <span className="rhythm-recap-icon" aria-hidden="true">{recap.vitaminDAtMs ? <Check size={15} /> : <Sun size={15} />}</span>
                <span className="rhythm-recap-text">
                  <strong>Vitamin D</strong>
                  <small>{recap.vitaminDAtMs ? `given at ${clockTime(recap.vitaminDAtMs)}` : isToday ? 'not yet today' : 'not logged'}</small>
                </span>
              </li>
              {/* Caregiver-defined trackers sit in the same list as the built-in
                  checks, in the tracker's own colour, so the recap covers what
                  this household actually tracks rather than only what shipped. */}
              {recap.customs.map((custom) => (
                <li
                  key={custom.id}
                  className={`rhythm-recap-item${custom.done ? ' is-done' : ''}`}
                  style={{ '--need-hue': customTrackerHueToken(custom.hue) } as CSSProperties}
                >
                  <span className="rhythm-recap-icon" aria-hidden="true">{custom.done ? <Check size={15} /> : <CustomTrackerIcon icon={custom.icon} size={15} />}</span>
                  <span className="rhythm-recap-text">
                    <strong>{custom.name}</strong>
                    <small>{custom.detail}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="rhythm-stage">
          <div className="rhythm-stage-sky" aria-hidden="true"><Sun size={18} /><span /><MoonStar size={18} /></div>
          <div className="rhythm-stage-track" role="group" aria-label={`Expanded timeline: ${view.summary}`}>
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
            {isToday ? <span className="rhythm-stage-now" style={{ left: pct(nowMs) }} aria-hidden="true"><i>Now</i></span> : null}
          </div>
          <div className="rhythm-stage-hours" aria-hidden="true"><span>Midnight</span><span>6 AM</span><span>Noon</span><span>6 PM</span><span>Midnight</span></div>
        </div>

        <div className={`rhythm-focus rhythm-focus--${selected?.tone ?? 'idle'}`} role="status" aria-live="polite">
          {selected ? <><span>{selected.eyebrow}</span><strong>{selected.title}</strong><time>{selected.time}</time>{selected.duration ? <b>{selected.duration}</b> : null}</> : details.length === 0 ? <><Sparkles size={18} /><strong>Nothing logged</strong><span>{isToday ? 'Today is still a blank page.' : 'This day has no moments saved.'}</span></> : <><Sparkles size={18} /><strong>Touch any moment</strong><span>The day will tell you its story.</span></>}
        </div>

        <div className="rhythm-modal-legend" aria-label="Timeline legend"><span className="legend-breast">Nursing</span><span className="legend-bottle">Bottle</span><span className="legend-diaper">Diaper</span><span className="legend-sleep">Sleep</span><span className="legend-tummy">Tummy</span></div>
      </section>
    </div>, document.body)
}

export function DayRibbon({ rhythm, rhythmForDay, earliestDayMs = null }: { rhythm: DayRhythm; rhythmForDay?: (dayAnchorMs: number) => DayRhythm; earliestDayMs?: number | null }) {
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
      {expanded ? <ExpandedRhythm rhythm={rhythm} rhythmForDay={rhythmForDay} earliestDayMs={earliestDayMs} onClose={closeExpanded} /> : null}
    </section>
  )
}
