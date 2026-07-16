import { Milk, TimerReset } from 'lucide-react'
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

type TrackOverviewProps = {
  today: TodaySummary
  pumpedOzToday: number
  pumpCountToday: number
  showBottleStat: boolean
  showPumpStat: boolean
  rhythm: DayRhythm
}

export function TrackOverview({ today, pumpedOzToday, pumpCountToday, showBottleStat, showPumpStat, rhythm }: TrackOverviewProps) {
  return (
    <>
      {showBottleStat || showPumpStat ? <section className="grid">
        {showBottleStat ? <div className="card stat stat-bottle"><h3><Milk size={15} /> Bottle</h3><p>{today.oz.toFixed(1)} oz</p></div> : null}
        {showPumpStat ? <div className="card stat pump-stat"><h3><TimerReset size={15} /> Pumped today</h3><p>{pumpedOzToday.toFixed(1)} oz</p><small>{pumpCountToday === 1 ? '1 session' : `${pumpCountToday} sessions`}</small></div> : null}
      </section> : null}

      <DayRibbon rhythm={rhythm} />
    </>
  )
}
