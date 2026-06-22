import type { Dispatch, SetStateAction } from 'react'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { calculateStats, calculateTrend } from '../domain/trackerDomain'
import { GrowthDashboard } from './GrowthDashboard'
import { BalanceAndNightCards, InsightGrid, RhythmCard, StatsHero, StatsStoryGrid } from './stats/StatsDashboardSections'

type StatsDashboardProps = {
  stats: ReturnType<typeof calculateStats>
  trend: ReturnType<typeof calculateTrend>
  growthMeasurements: GrowthMeasurement[]
  setGrowthMeasurements: Dispatch<SetStateAction<GrowthMeasurement[]>>
}

export function StatsDashboard({ stats, trend, growthMeasurements, setGrowthMeasurements }: StatsDashboardProps) {
  return (
    <section className="stats-page" aria-label="Stats dashboard">
      <StatsHero stats={stats} />
      <InsightGrid stats={stats} />
      <StatsStoryGrid stats={stats} />
      <RhythmCard trend={trend} />
      <BalanceAndNightCards stats={stats} />
      <GrowthDashboard growthMeasurements={growthMeasurements} setGrowthMeasurements={setGrowthMeasurements} />
    </section>
  )
}
