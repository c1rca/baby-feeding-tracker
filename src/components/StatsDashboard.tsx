import type { calculateStats, calculateTrend } from '../domain/trackerDomain'
import { BalanceAndNightCards, InsightGrid, RhythmCard, StatsHero, StatsStoryGrid } from './stats/StatsDashboardSections'

type StatsDashboardProps = {
  stats: ReturnType<typeof calculateStats>
  trend: ReturnType<typeof calculateTrend>
}

export function StatsDashboard({ stats, trend }: StatsDashboardProps) {
  return (
    <section className="stats-page" aria-label="Stats dashboard">
      <StatsHero stats={stats} />
      <InsightGrid stats={stats} />
      <StatsStoryGrid stats={stats} />
      <RhythmCard trend={trend} />
      <BalanceAndNightCards stats={stats} />
    </section>
  )
}
