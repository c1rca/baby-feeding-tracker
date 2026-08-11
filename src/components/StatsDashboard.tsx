import type { Dispatch, SetStateAction } from 'react'
import { Baby, ChartNoAxesCombined, Droplets, Dumbbell, Milk, Syringe, TimerReset } from 'lucide-react'
import type { GrowthMeasurement } from '../domain/growthTypes'
import type { calculateStats, calculateTrend } from '../domain/trackerDomain'
import { GrowthDashboard } from './GrowthDashboard'
import { HealthDashboard } from './HealthDashboard'
import type { HealthRecord } from '../types'
import { BalanceAndNightCards, CustomTrackerStatsCard, FeedingHoursCard, InsightGrid, PumpingStatsCard, RhythmCard, StatsStoryGrid, TummyTimeStatsCard } from './stats/StatsDashboardSections'
import { activeCustomTrackers, customTrackerStats } from '../domain/customTrackers'
import { CustomTrackerIcon } from './customTrackerIcons'
import type { CustomEvent, CustomTracker } from '../types'

const statsDestinations = [
  { href: '#feeding-stats', label: 'Feeding', detail: 'Rhythm & time', icon: Milk },
  { href: '#diaper-stats', label: 'Diapers', detail: 'Daily signals', icon: Droplets },
  { href: '#tummy-stats', label: 'Tummy time', detail: 'Movement goal', icon: Dumbbell },
  { href: '#pump-stats', label: 'Pumping', detail: 'Output per day', icon: TimerReset },
  { href: '#growth-stats', label: 'Growth', detail: 'Percentiles', icon: ChartNoAxesCombined },
  { href: '#health-stats', label: 'Health', detail: 'Shots & milestones', icon: Syringe },
] as const

type StatsDashboardProps = {
  stats: ReturnType<typeof calculateStats>
  trend: ReturnType<typeof calculateTrend>
  growthMeasurements: GrowthMeasurement[]
  setGrowthMeasurements: Dispatch<SetStateAction<GrowthMeasurement[]>>
  babyDob: string
  babySex?: 'female' | 'male' | null
  healthRecords?: HealthRecord[]
  customTrackers?: CustomTracker[]
  customEvents?: CustomEvent[]
  setHealthRecords?: Dispatch<SetStateAction<HealthRecord[]>>
  now: number
  statsRangeDays?: number
  setStatsRangeDays?: (days: number) => void
  statsRangeOptions?: readonly number[]
}

export function StatsDashboard({ stats, trend, growthMeasurements, setGrowthMeasurements, babyDob, babySex = null, healthRecords = [], setHealthRecords, customTrackers = [], customEvents = [], now, statsRangeDays = 7, setStatsRangeDays, statsRangeOptions = [7, 14, 30] }: StatsDashboardProps) {
  // The day windows the built-in cards are already charted against, reused so a
  // custom tracker's bars line up with tummy time's rather than drifting a day.
  const trackerStats = activeCustomTrackers(customTrackers).map((tracker) => customTrackerStats(tracker, customEvents, stats.tummyDays))
  return (
    <section className="stats-page" aria-label="Stats dashboard">
      <nav className="stats-jump-menu" aria-label="Jump to care insights">
        <div className="stats-jump-menu-intro"><span><Baby size={15} /> Care at a glance</span><strong>{stats.recentEntries.length} feeds in {stats.rangeLabel}</strong></div>
        {setStatsRangeDays ? (
          <div className="stats-range-picker care-segmented" role="group" aria-label="Stats date range">
            {statsRangeOptions.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={statsRangeDays === days}
                className={statsRangeDays === days ? 'is-active' : ''}
                onClick={() => setStatsRangeDays(days)}
              >
                {days} days
              </button>
            ))}
          </div>
        ) : null}
        <div className="stats-jump-menu-links">
          {statsDestinations.map(({ href, label, detail, icon: Icon }) => (
            <a key={href} href={href} className="stats-jump-link"><Icon size={18} /><span><strong>{label}</strong><small>{detail}</small></span></a>
          ))}
          {trackerStats.map(({ tracker }) => (
            <a key={tracker.id} href={`#custom-stats-${tracker.id}`} className="stats-jump-link"><CustomTrackerIcon icon={tracker.icon} size={18} /><span><strong>{tracker.name}</strong><small>Your tracker</small></span></a>
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
      <section id="pump-stats" className="stats-anchor-section" aria-label="Pumping insights"><PumpingStatsCard stats={stats} /></section>
      {trackerStats.map((entry) => (
        <section key={entry.tracker.id} id={`custom-stats-${entry.tracker.id}`} className="stats-anchor-section" aria-label={`${entry.tracker.name} insights`}>
          <CustomTrackerStatsCard stats={entry} rangeDays={statsRangeDays} />
        </section>
      ))}
      <section id="growth-stats" className="stats-anchor-section" aria-label="Growth insights"><GrowthDashboard growthMeasurements={growthMeasurements} setGrowthMeasurements={setGrowthMeasurements} babyDob={babyDob} babySex={babySex} /></section>
      {setHealthRecords ? <section id="health-stats" className="stats-anchor-section" aria-label="Health insights"><HealthDashboard healthRecords={healthRecords} setHealthRecords={setHealthRecords} babyDob={babyDob} now={now} /></section> : null}
    </section>
  )
}
