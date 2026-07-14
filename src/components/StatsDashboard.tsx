import type { Dispatch, SetStateAction } from 'react'
import { Baby, ChartNoAxesCombined, Droplets, Dumbbell, Milk } from 'lucide-react'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { calculateStats, calculateTrend } from '../domain/trackerDomain'
import { GrowthDashboard } from './GrowthDashboard'
import { BalanceAndNightCards, FeedingHoursCard, InsightGrid, RhythmCard, StatsHero, StatsStoryGrid, TummyTimeStatsCard } from './stats/StatsDashboardSections'

const statsDestinations = [
  { href: '#feeding-stats', label: 'Feeding', detail: 'Rhythm & time', icon: Milk },
  { href: '#diaper-stats', label: 'Diapers', detail: 'Daily signals', icon: Droplets },
  { href: '#tummy-stats', label: 'Tummy time', detail: 'Movement goal', icon: Dumbbell },
  { href: '#growth-stats', label: 'Growth', detail: 'Percentiles', icon: ChartNoAxesCombined },
] as const

type StatsDashboardProps = {
  stats: ReturnType<typeof calculateStats>
  trend: ReturnType<typeof calculateTrend>
  growthMeasurements: GrowthMeasurement[]
  setGrowthMeasurements: Dispatch<SetStateAction<GrowthMeasurement[]>>
  babyDob: string
}

export function StatsDashboard({ stats, trend, growthMeasurements, setGrowthMeasurements, babyDob }: StatsDashboardProps) {
  return (
    <section className="stats-page" aria-label="Stats dashboard">
      <StatsHero stats={stats} />
      <nav className="stats-jump-menu" aria-label="Jump to care insights">
        <div className="stats-jump-menu-intro"><span><Baby size={15} /> Care at a glance</span><strong>Jump to what matters</strong></div>
        <div className="stats-jump-menu-links">
          {statsDestinations.map(({ href, label, detail, icon: Icon }) => (
            <a key={href} href={href} className="stats-jump-link"><Icon size={18} /><span><strong>{label}</strong><small>{detail}</small></span></a>
          ))}
        </div>
      </nav>
      <section id="feeding-stats" className="stats-anchor-section" aria-label="Feeding insights">
        <InsightGrid stats={stats} />
        <FeedingHoursCard stats={stats} />
        <RhythmCard trend={trend} />
        <BalanceAndNightCards stats={stats} />
      </section>
      <section id="diaper-stats" className="stats-anchor-section" aria-label="Diaper insights"><StatsStoryGrid stats={stats} /></section>
      <section id="tummy-stats" className="stats-anchor-section" aria-label="Tummy Time insights"><TummyTimeStatsCard stats={stats} /></section>
      <section id="growth-stats" className="stats-anchor-section" aria-label="Growth insights"><GrowthDashboard growthMeasurements={growthMeasurements} setGrowthMeasurements={setGrowthMeasurements} babyDob={babyDob} /></section>
    </section>
  )
}
