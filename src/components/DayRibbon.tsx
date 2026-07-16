import { useState, type CSSProperties } from 'react'
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

type Detail = { id: string; title: string; eyebrow: string; time: string; duration?: string; anchor: string; tone: string }

export function DayRibbon({ rhythm }: { rhythm: DayRhythm }) {
  const { dayStartMs, dayEndMs, nowMs, feeds, diapers, spans, summary } = rhythm
  const [active, setActive] = useState<Detail | null>(null)
  const [pinned, setPinned] = useState(false)
  const dayMs = dayEndMs - dayStartMs
  const pct = (at: number) => `${(((at - dayStartMs) / dayMs) * 100).toFixed(2)}%`
  const widthPct = (start: number, end: number) => `${(Math.max(end - start, 0) / dayMs * 100).toFixed(2)}%`
  const isEmpty = feeds.length === 0 && diapers.length === 0 && spans.length === 0
  const show = (detail: Detail, pin = false) => { setActive(detail); setPinned(pin) }
  const toggle = (detail: Detail) => { const closing = pinned && active?.id === detail.id; setActive(closing ? null : detail); setPinned(!closing) }
  const leave = () => { if (!pinned) setActive(null) }

  return (
    <section className="card day-ribbon-card">
      <div className="section-heading"><h2>Today's rhythm</h2><span className="muted">{isEmpty ? 'a fresh day' : summary}</span></div>
      <div className="day-ribbon" role="group" aria-label={isEmpty ? "Today's rhythm: nothing logged yet" : `Today's rhythm: ${summary}`} onMouseLeave={leave}>
        <div className="day-ribbon-track">
          {spans.map((span) => {
            const detail: Detail = { id: span.id, title: spanTitle[span.kind], eyebrow: 'Care session', time: `${clockTime(span.startMs)} to ${clockTime(span.endMs)}`, duration: durationText(span.startMs, span.endMs), anchor: pct(span.startMs + (span.endMs - span.startMs) / 2), tone: span.kind }
            return <button type="button" key={span.id} className={`day-ribbon-span day-ribbon-span--${span.kind}`} style={{ left: pct(span.startMs), width: widthPct(span.startMs, span.endMs) }} aria-label={`${detail.title} from ${detail.time}, ${detail.duration}`} aria-expanded={active?.id === span.id} onMouseEnter={() => show(detail)} onFocus={() => show(detail)} onBlur={leave} onClick={() => toggle(detail)} />
          })}
          {feeds.map((feed) => {
            const detail: Detail = { id: feed.id, title: feedTitle[feed.type], eyebrow: 'Feed', time: `${clockTime(feed.atMs)} to ${clockTime(feed.endMs)}`, duration: durationText(feed.atMs, feed.endMs), anchor: pct(feed.atMs), tone: feed.type }
            return <button type="button" key={feed.id} className={`day-ribbon-feed day-ribbon-feed--${feed.type}`} style={{ left: pct(feed.atMs) }} aria-label={`${detail.title} at ${clockTime(feed.atMs)}, ${detail.duration}`} aria-expanded={active?.id === feed.id} onMouseEnter={() => show(detail)} onFocus={() => show(detail)} onBlur={leave} onClick={() => toggle(detail)} />
          })}
          {diapers.map((diaper) => {
            const detail: Detail = { id: diaper.id, title: diaperTitle[diaper.kind], eyebrow: 'Diaper change', time: clockTime(diaper.atMs), anchor: pct(diaper.atMs), tone: `diaper-${diaper.kind}` }
            return <button type="button" key={diaper.id} className={`day-ribbon-tick day-ribbon-tick--${diaper.kind}`} style={{ left: pct(diaper.atMs) }} aria-label={`${detail.title} at ${detail.time}`} aria-expanded={active?.id === diaper.id} onMouseEnter={() => show(detail)} onFocus={() => show(detail)} onBlur={leave} onClick={() => toggle(detail)} />
          })}
          <span className="day-ribbon-now" style={{ left: pct(nowMs) }} aria-hidden="true" />
          {active ? <div className={`day-ribbon-tooltip day-ribbon-tooltip--${active.tone}`} style={{ '--rhythm-anchor': active.anchor } as CSSProperties} role="tooltip"><span>{active.eyebrow}</span><strong>{active.title}</strong><div><time>{active.time}</time>{active.duration ? <b>{active.duration}</b> : null}</div><i aria-hidden="true" /></div> : null}
        </div>
        <div className="day-ribbon-hours" aria-hidden="true"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>
      </div>
      <div className="day-ribbon-legend" aria-hidden="true"><span className="day-ribbon-legend-item legend-breast">Nursing</span><span className="day-ribbon-legend-item legend-bottle">Bottle</span><span className="day-ribbon-legend-item legend-diaper">Diaper</span><span className="day-ribbon-legend-item legend-sleep">Sleep</span><span className="day-ribbon-legend-item legend-tummy">Tummy</span></div>
    </section>
  )
}
