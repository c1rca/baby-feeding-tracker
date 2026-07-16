import type { DayRhythm } from '../domain/dayRhythm'

const clockTime = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const feedTitle = { breast: 'Nursing', bottle: 'Bottle', mixed: 'Nursing + bottle' } as const
const diaperTitle = { wet: 'Wet diaper', stool: 'Stool diaper', mixed: 'Wet + stool diaper' } as const
const spanTitle = { sleep: 'Sleep', tummy: 'Tummy time' } as const

export function DayRibbon({ rhythm }: { rhythm: DayRhythm }) {
  const { dayStartMs, dayEndMs, nowMs, feeds, diapers, spans, summary } = rhythm
  const dayMs = dayEndMs - dayStartMs
  const pct = (at: number) => `${(((at - dayStartMs) / dayMs) * 100).toFixed(2)}%`
  const widthPct = (start: number, end: number) => `${(Math.max(end - start, 0) / dayMs * 100).toFixed(2)}%`
  const isEmpty = feeds.length === 0 && diapers.length === 0 && spans.length === 0

  return (
    <section className="card day-ribbon-card">
      <div className="section-heading">
        <h2>Today's rhythm</h2>
        <span className="muted">{isEmpty ? 'a fresh day' : summary}</span>
      </div>
      <div className="day-ribbon" role="img" aria-label={isEmpty ? "Today's rhythm: nothing logged yet" : `Today's rhythm: ${summary}`}>
        <div className="day-ribbon-track" aria-hidden="true">
          {spans.map((span) => (
            <span
              key={span.id}
              className={`day-ribbon-span day-ribbon-span--${span.kind}`}
              style={{ left: pct(span.startMs), width: widthPct(span.startMs, span.endMs) }}
              title={`${spanTitle[span.kind]} · ${clockTime(span.startMs)}`}
            />
          ))}
          {feeds.map((feed) => (
            <span
              key={feed.id}
              className={`day-ribbon-feed day-ribbon-feed--${feed.type}`}
              style={{ left: pct(feed.atMs) }}
              title={`${feedTitle[feed.type]} · ${clockTime(feed.atMs)}`}
            />
          ))}
          {diapers.map((diaper) => (
            <span
              key={diaper.id}
              className={`day-ribbon-tick day-ribbon-tick--${diaper.kind}`}
              style={{ left: pct(diaper.atMs) }}
              title={`${diaperTitle[diaper.kind]} · ${clockTime(diaper.atMs)}`}
            />
          ))}
          <span className="day-ribbon-now" style={{ left: pct(nowMs) }} title={`Now · ${clockTime(nowMs)}`} />
        </div>
        <div className="day-ribbon-hours" aria-hidden="true">
          <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
        </div>
      </div>
      <div className="day-ribbon-legend" aria-hidden="true">
        <span className="day-ribbon-legend-item legend-breast">Nursing</span>
        <span className="day-ribbon-legend-item legend-bottle">Bottle</span>
        <span className="day-ribbon-legend-item legend-diaper">Diaper</span>
        <span className="day-ribbon-legend-item legend-sleep">Sleep</span>
        <span className="day-ribbon-legend-item legend-tummy">Tummy</span>
      </div>
    </section>
  )
}
