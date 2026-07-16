import { Baby, Droplets, HeartPulse, Milk, Scale, TimerReset } from 'lucide-react'
import { formatDuration } from '../domain/feedingUtils'

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
}

export function TrackOverview({ today, trend, pumpedOzToday, pumpCountToday }: TrackOverviewProps) {
  return (
    <>
      <section className="grid">
        <div className="card stat stat-feeds"><h3><HeartPulse size={15} /> Feeds today</h3><p>{today.count}</p></div>
        <div className="card stat stat-nursing"><h3><Baby size={15} /> Nursing</h3><p>{formatDuration(today.nursing)}</p></div>
        <div className="card stat stat-bottle"><h3><Milk size={15} /> Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div>
        <div className="card stat stat-split"><h3><Scale size={15} /> L / R split</h3><p>{formatDuration(today.left)} / {formatDuration(today.right)}</p></div>
        <div className="card stat pump-stat"><h3><TimerReset size={15} /> Pumped today</h3><p>{pumpedOzToday.toFixed(1)} oz</p><small>{pumpCountToday === 1 ? '1 session' : `${pumpCountToday} sessions`}</small></div>
        <div className="card stat diaper-stat"><h3><Droplets size={15} /> Diapers today</h3><p>{today.wet} wet · {today.stool} stool</p></div>
      </section>

      <section className="card">
        <div className="section-heading"><h2>7-Day Trend</h2><span className="muted">feeds per day</span></div>
        <div className="trend" role="group" aria-label="7-day feeding trend">{trend.days.map((d) => <div key={d.label} className="trend-col" aria-label={`${d.label}: ${d.count} feeds`}><strong>{d.count}</strong><div className="trend-track"><div className="trend-bar" style={{ height: `${Math.max(12, (d.count / trend.max) * 100)}%` }} /></div><span>{d.label}</span></div>)}</div>
      </section>
    </>
  )
}
