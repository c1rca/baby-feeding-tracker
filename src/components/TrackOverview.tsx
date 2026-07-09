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
  tummyMinutesToday: number
  tummyGoalMinutes: number
  tummyGoalPercentToday: number
}

export function TrackOverview({ today, trend, tummyMinutesToday, tummyGoalMinutes, tummyGoalPercentToday }: TrackOverviewProps) {
  return (
    <>
      <section className="grid">
        <div className="card stat stat-feeds"><h3><HeartPulse size={15} /> Feeds today</h3><p>{today.count}</p></div>
        <div className="card stat stat-nursing"><h3><Baby size={15} /> Nursing</h3><p>{formatDuration(today.nursing)}</p></div>
        <div className="card stat tummy-stat"><h3><TimerReset size={15} /> Tummy Time today</h3><p>{tummyMinutesToday}/{tummyGoalMinutes} min</p><small>{tummyGoalPercentToday}% of goal</small></div>
        <div className="card stat stat-split"><h3><Scale size={15} /> L / R split</h3><p>{formatDuration(today.left)} / {formatDuration(today.right)}</p></div>
        <div className="card stat stat-bottle"><h3><Milk size={15} /> Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div>
        <div className="card stat diaper-stat"><h3><Droplets size={15} /> Diapers today</h3><p>{today.wet} wet · {today.stool} stool</p></div>
      </section>

      <section className="card">
        <div className="section-heading"><h2>7-Day Trend</h2><span className="muted">feeds per day</span></div>
        <div className="trend">{trend.days.map((d) => <div key={d.label} className="trend-col"><div className="trend-bar" style={{ height: `${(d.count / trend.max) * 60 + 8}px` }} /><span>{d.label}</span><small>{d.count}</small></div>)}</div>
      </section>
    </>
  )
}
