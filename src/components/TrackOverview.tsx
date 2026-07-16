import { Baby, Droplets, HeartPulse, Milk, TimerReset } from 'lucide-react'
import { formatDuration } from '../domain/feedingUtils'
import type { DayRhythm } from '../domain/dayRhythm'
import { DayRibbon } from './DayRibbon'

type TodaySummary = {
  count: number
  nursing: number
  oz: number
  left: number
  right: number
  wet: number
  stool: number
}

type TrendSummary = {
  max: number
  days: Array<{ label: string; count: number }>
}

type TrackOverviewProps = {
  today: TodaySummary
  trend: TrendSummary
  pumpedOzToday: number
  pumpCountToday: number
  showBottleStat: boolean
  showPumpStat: boolean
  rhythm: DayRhythm
}

export function TrackOverview({ today, trend, pumpedOzToday, pumpCountToday, showBottleStat, showPumpStat, rhythm }: TrackOverviewProps) {
  return (
    <>
      <section className="grid">
        <div className="card stat stat-feeds"><h3><HeartPulse size={15} /> Feeds today</h3><p>{today.count}</p></div>
        <div className="card stat stat-nursing"><h3><Baby size={15} /> Nursing</h3><p>{formatDuration(today.nursing)}</p></div>
        {showBottleStat ? <div className="card stat stat-bottle"><h3><Milk size={15} /> Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div> : null}
        {showPumpStat ? <div className="card stat pump-stat"><h3><TimerReset size={15} /> Pumped today</h3><p>{pumpedOzToday.toFixed(1)} oz</p><small>{pumpCountToday === 1 ? '1 session' : `${pumpCountToday} sessions`}</small></div> : null}
        <div className="card stat diaper-stat"><h3><Droplets size={15} /> Diapers today</h3><p>{today.wet} wet · {today.stool} stool</p></div>
      </section>

      <DayRibbon rhythm={rhythm} />

      <section className="card">
        <div className="section-heading"><div><h2>7-Day Trend</h2><span className="muted">A compact view of feeding rhythm</span></div><span className="trend-average">{(trend.days.reduce((sum, day) => sum + day.count, 0) / Math.max(1, trend.days.length)).toFixed(1)} avg</span></div>
        <div className="trend" role="group" aria-label="7-day feeding trend">
          <span className="sr-only">Daily feed count</span>
          {trend.days.map((d, index) => {
            const isToday = index === trend.days.length - 1
            return <div key={d.label} className={`trend-col${isToday ? ' is-today' : ''}`} aria-label={`${d.label}: ${d.count} feeds${isToday ? ', today' : ''}`}><strong>{d.count}</strong><div className="trend-track"><div className="trend-bar" style={{ height: `${Math.max(10, (d.count / Math.max(1, trend.max)) * 100)}%` }} /></div><span>{d.label}</span></div>
          })}
        </div>
      </section>
    </>
  )
}
