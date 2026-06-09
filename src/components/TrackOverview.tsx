import { X } from 'lucide-react'
import type { MedicineKind } from '../types'
import { formatDuration } from '../domain/feedingUtils'

type MedicineReminder = {
  id: string
  label: string
  recommendedKind: MedicineKind
  recommendedLabel: string
  at: number
}

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
  medicineReminder: MedicineReminder | null
  showMedicineReminder: boolean
  dismissMedicineReminder: (id: string) => void
}

export function TrackOverview({ today, trend, medicineReminder, showMedicineReminder, dismissMedicineReminder }: TrackOverviewProps) {
  return (
    <>
      {showMedicineReminder && medicineReminder ? (
        <div className="medicine-reminder-banner" role="alert">
          <div><strong>Medicine reminder</strong><span>Take {medicineReminder.recommendedLabel}. Last dose was {medicineReminder.label} 6+ hours ago.</span></div>
          <button type="button" className="icon-plain" aria-label="Dismiss medicine reminder" onClick={() => dismissMedicineReminder(medicineReminder.id)}><X size={16} /></button>
        </div>
      ) : null}

      <section className="grid">
        <div className="card stat"><h3>Feeds today</h3><p>{today.count}</p></div>
        <div className="card stat"><h3>Nursing</h3><p>{formatDuration(today.nursing)}</p></div>
        <div className="card stat"><h3>Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div>
        <div className="card stat"><h3>L / R split</h3><p>{formatDuration(today.left)} / {formatDuration(today.right)}</p></div>
        <div className="card stat diaper-stat"><h3>Diapers today</h3><p>{today.wet} wet · {today.stool} stool</p></div>
      </section>

      <section className="card">
        <h2>7-Day Trend</h2>
        <div className="trend">{trend.days.map((d) => <div key={d.label} className="trend-col"><div className="trend-bar" style={{ height: `${(d.count / trend.max) * 60 + 8}px` }} /><span>{d.label}</span><small>{d.count}</small></div>)}</div>
      </section>
    </>
  )
}
