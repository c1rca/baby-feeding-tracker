import type { CSSProperties } from 'react'
import { Activity, Baby, Clock3, Droplets, HeartPulse, MoonStar, Target, Trophy, Waves } from 'lucide-react'
import { formatDuration } from '../../domain/feedingUtils'
import type { calculateStats, calculateTrend } from '../../domain/trackerDomain'

type Stats = ReturnType<typeof calculateStats>
type Trend = ReturnType<typeof calculateTrend>

const formatAverage = (value: number) => value.toFixed(1)

export function InsightGrid({ stats }: { stats: Stats }) {
  return (
    <div className="insight-grid">
      <article className="insight-card primary-insight"><Clock3 size={19} /><span>Average spacing</span><strong>{stats.avgGap ? formatDuration(stats.avgGap) : 'Not yet'}</strong><small>between recent feeds</small></article>
      <article className="insight-card"><Droplets size={19} /><span>Total bottle</span><strong>{stats.totalBottle.toFixed(1)} oz</strong><small>{stats.bottleFeeds} bottle feeds this week</small></article>
      <article className="insight-card"><Baby size={19} /><span>Avg nursing</span><strong>{stats.avgNursing ? formatDuration(stats.avgNursing) : 'Not yet'}</strong><small>per nursing feed</small></article>
      <article className="insight-card"><Trophy size={19} /><span>Busiest day</span><strong>{stats.bestDay.label}</strong><small>{stats.bestDay.count} feeds logged</small></article>
      <article className="insight-card"><Activity size={19} /><span>24h momentum</span><strong>{stats.last24Entries.length}</strong><small>{stats.momentumLabel}</small></article>
      <article className="insight-card"><Waves size={19} /><span>Longest stretch</span><strong>{stats.longestGapLabel}</strong><small>between feeds this week</small></article>
      <article className="insight-card"><HeartPulse size={19} /><span>Longest nursing</span><strong>{stats.longestNursing ? formatDuration(stats.longestNursing) : 'Not yet'}</strong><small>single feed stamina</small></article>
      <article className="insight-card"><Target size={19} /><span>Next side cue</span><strong>{stats.nextSideLabel}</strong><small>{stats.balanceLabel}</small></article>
    </div>
  )
}

export function StatsStoryGrid({ stats }: { stats: Stats }) {
  return (
    <section className="stats-story-grid">
      <article className="card story-card">
        <span className="stats-kicker">Smart read</span>
        <h2>{stats.recentEntries.length ? `${stats.avgFeedsPerDay} feeds/day cadence` : 'Cadence will appear here'}</h2>
        <p>{stats.recentEntries.length ? `The last 24 hours logged ${stats.last24Entries.length} feeds, with the longest calm stretch at ${stats.longestGapLabel}.` : 'Once feeds are logged, this card summarizes pace, recovery windows, and the shape of the week.'}</p>
      </article>
      <article className="card diaper-signal-card">
        <div><span className="stats-kicker">Diaper signal</span><div className="diaper-signal-values"><strong>{stats.wetCount}<small>wet</small></strong><strong>{stats.stoolCount}<small>stool</small></strong></div></div>
        <div className="diaper-average-grid" aria-label="Diaper daily averages">
          <div className="diaper-average-row">
            <span>Wet/day</span>
            <strong>{formatAverage(stats.diaperAverages.wet.weekly)}</strong>
            <small>Today: {stats.diaperAverages.wet.today} · All-time: {formatAverage(stats.diaperAverages.wet.allTime)}</small>
          </div>
          <div className="diaper-average-row">
            <span>Stool/day</span>
            <strong>{formatAverage(stats.diaperAverages.stool.weekly)}</strong>
            <small>Today: {stats.diaperAverages.stool.today} · All-time: {formatAverage(stats.diaperAverages.stool.allTime)}</small>
          </div>
        </div>
        <p>Averages cover the last 7 days; mixed diapers count toward both signals.</p>
      </article>
      <article className="card diaper-signal-card vitamin-stats-card">
        <div><span className="stats-kicker">Vitamin D</span><div className="diaper-signal-values"><strong>{stats.vitaminDTakenToday ? '✓' : '0'}<small>{stats.vitaminDTakenToday ? 'Taken today' : 'Not today'}</small></strong><strong>{stats.vitaminDDosesThisWeek}<small>week</small></strong></div></div>
        <div className="diaper-average-grid" aria-label="Vitamin D summary">
          <div className="diaper-average-row">
            <span>Daily vitamin</span>
            <strong>{stats.vitaminDTakenToday ? 'Taken today' : 'Due today'}</strong>
            <small>{stats.vitaminDDosesThisWeek} {stats.vitaminDDosesThisWeek === 1 ? 'dose' : 'doses'} this week</small>
          </div>
        </div>
        <p>One dose a day, tracked against the week.</p>
      </article>
    </section>
  )
}

export function FeedingHoursCard({ stats }: { stats: Stats }) {
  return (
    <section className="card stat-hero feeding-hours-card" aria-label="Daily feeding hours">
      <div className="stat-hero-copy feeding-hours-copy">
        <span className="stats-kicker">Time invested</span>
        <h2>{stats.totalNursing ? `${stats.avgFeedingHoursPerDay} hrs/day` : 'Hours per day will appear here'}</h2>
        <p>{stats.totalNursing ? `${formatDuration(stats.totalNursing)} of nursing time captured across the last 7 days.` : 'Log nursing sessions to see daily feeding-time intensity and patterns.'}</p>
      </div>
      <div className="stat-bars feeding-hours-bars">
        {stats.feedingHoursByDay.map((day) => (
          <div key={day.label} className="stat-bar-day feeding-hours-day">
            <div className="stat-bar-track feeding-hours-track" aria-label={`${day.label}: ${day.hours} feeding hours`}>
              <div style={{ height: `${Math.max(day.seconds ? 12 : 0, (day.seconds / stats.maxFeedingSeconds) * 100)}%` }} />
            </div>
            <strong>{day.hours ? `${day.hours}h` : ''}</strong>
            <span>{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function TummyTimeStatsCard({ stats }: { stats: Stats }) {
  const hasTummyTime = stats.tummyTotalMinutes > 0 || stats.tummyMinutesToday > 0
  return (
    <section className="card stat-hero tummy-stats-card" aria-label="Tummy Time stats">
      <div className="tummy-stats-main">
        <div className="stat-hero-copy tummy-stats-copy">
          <span className="stats-kicker">Tummy Time</span>
          <h2>{hasTummyTime ? `${stats.tummyMinutesToday}/${stats.tummyDailyGoalMinutes} min today` : 'Tummy Time starts here'}</h2>
          <p>{hasTummyTime ? `${stats.tummyTotalMinutes} minutes captured this week · ${stats.tummyGoalDays} goal ${stats.tummyGoalDays === 1 ? 'day' : 'days'} hit.` : 'Log quick adds or use the timer to see daily progress, weekly consistency, and best-day momentum.'}</p>
        </div>
        <div className="tummy-progress-orb" style={{ '--progress': `${stats.tummyGoalPercentToday}%` } as CSSProperties} aria-label={`Today Tummy Time progress ${stats.tummyGoalPercentToday}%`}>
          <strong>{stats.tummyGoalPercentToday}%</strong>
          <span>today</span>
        </div>
        <div className="tummy-mini-stats" aria-label="Tummy Time summary">
          <div><span>Daily avg</span><strong>{stats.tummyAverageMinutesPerDay}m</strong></div>
          <div><span>Best day</span><strong>{stats.tummyBestDay.minutes ? `${stats.tummyBestDay.label} · ${stats.tummyBestDay.minutes}m` : 'Not yet'}</strong></div>
        </div>
      </div>
      <div className="stat-bars tummy-week-bars" aria-label="Tummy Time last 7 days">
        {stats.tummyDays.map((day) => (
          <div key={day.label} className="stat-bar-day tummy-week-day">
            <div className="stat-bar-track tummy-week-track" aria-label={`${day.label}: ${day.minutes} Tummy Time minutes`}><div style={{ height: `${Math.max(day.minutes ? 12 : 0, day.goalPercent)}%` }} /></div>
            <strong>{day.minutes ? `${day.minutes}m` : ''}</strong>
            <span>{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function RhythmCard({ trend }: { trend: Trend }) {
  const total = trend.days.reduce((sum, day) => sum + day.count, 0)
  const avgPerDay = total ? (total / 7).toFixed(1) : '0'
  const peak = trend.days.reduce((best, day) => (day.count > best.count ? day : best), trend.days[0] ?? { label: '', count: 0 })
  return (
    <section className="card stat-hero rhythm-card" aria-label="Feeding rhythm">
      <div className="stat-hero-copy">
        <span className="stats-kicker">Feeding rhythm</span>
        <h2>{total ? `${avgPerDay} feeds/day` : 'Rhythm appears here'}</h2>
        <p>{total ? `${total} feeds across the last 7 days · busiest was ${peak.label} with ${peak.count}.` : 'Log feeds to see the shape of each day fill in across the week.'}</p>
      </div>
      <div className="stat-bars rhythm-bars">
        {trend.days.map((day) => (
          <div key={day.label} className="stat-bar-day rhythm-day">
            <div className="stat-bar-track rhythm-track" aria-label={`${day.label}: ${day.count} feeds`}><div style={{ height: `${Math.max(day.count ? 12 : 0, (day.count / trend.max) * 100)}%` }} /></div>
            <strong>{day.count || ''}</strong>
            <span>{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function BalanceAndNightCards({ stats }: { stats: Stats }) {
  const nightMax = Math.max(1, ...stats.nightByDay.map((day) => day.count))
  return (
    <section className="stats-split">
      <article className="card balance-card">
        <div className="section-heading"><h2>Side balance</h2><span className="muted">L / R</span></div>
        <div className="balance-orb" style={{ '--left': `${stats.leftPercent}%` } as CSSProperties}><strong>{stats.leftPercent}%</strong><span>left</span></div>
        <div className="balance-labels"><span>L {formatDuration(stats.totalLeft)}</span><span>R {formatDuration(stats.totalRight)}</span></div>
      </article>
      <article className="card night-card">
        <div className="section-heading"><h2>Night watch</h2><span className="muted">10 PM – 6 AM</span></div>
        <div className="night-hero">
          <span className="night-hero-icon"><MoonStar size={22} /></span>
          <div className="night-hero-figure">
            <strong>{stats.nightFeeds}</strong>
            <span>overnight {stats.nightFeeds === 1 ? 'feed' : 'feeds'} this week</span>
          </div>
        </div>
        <div className="night-metrics" aria-label="Night watch summary">
          <div><span>Per night</span><strong>{stats.nightAvgPerNight}</strong></div>
          <div><span>Share</span><strong>{stats.nightShare}%</strong></div>
          <div><span>Longest calm</span><strong>{stats.longestGapLabel}</strong></div>
        </div>
        <div className="night-strip" aria-label="Overnight feeds by night">
          {stats.nightByDay.map((day) => (
            <div key={day.label} className="night-strip-day">
              <div className="night-strip-track" aria-label={`${day.label}: ${day.count} overnight ${day.count === 1 ? 'feed' : 'feeds'}`}><div style={{ height: `${day.count ? Math.max(14, (day.count / nightMax) * 100) : 0}%` }} /></div>
              <span>{day.label}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}
