import { Milk, TimerReset } from 'lucide-react'
import type { DayRhythm } from '../domain/dayRhythm'
import { DayRibbon } from './DayRibbon'
import { useUnits } from '../state/unitPreferencesContext'
import { formatVolume } from '../domain/units'

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
  // Lets the expanded rhythm rebuild any past day from the same event log.
  rhythmForDay?: (dayAnchorMs: number) => DayRhythm
  earliestDayMs?: number | null
}

export function TrackOverview({ today, pumpedOzToday, pumpCountToday, showBottleStat, showPumpStat, rhythm, rhythmForDay, earliestDayMs }: TrackOverviewProps) {
  const { units } = useUnits()
  return (
    <>
      {showBottleStat || showPumpStat ? <section className="grid">
        {showBottleStat ? <div className="card stat stat-bottle"><h3><Milk size={15} /> Bottle</h3><p>{formatVolume(today.oz, units.volume)}</p></div> : null}
        {showPumpStat ? <div className="card stat pump-stat"><h3><TimerReset size={15} /> Pumped today</h3><p>{formatVolume(pumpedOzToday, units.volume)}</p><small>{pumpCountToday === 1 ? '1 session' : `${pumpCountToday} sessions`}</small></div> : null}
      </section> : null}

      <DayRibbon rhythm={rhythm} rhythmForDay={rhythmForDay} earliestDayMs={earliestDayMs} />
    </>
  )
}
