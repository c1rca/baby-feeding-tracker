import type { CSSProperties } from 'react'
import { Activity, Baby, CalendarDays, Clock3, Droplets, HeartPulse, Sparkles, Target, Trophy, Waves } from 'lucide-react'
import { formatDuration } from '../domain/feedingUtils'
import type { calculateStats, calculateTrend } from '../domain/trackerDomain'

type StatsDashboardProps = {
  stats: ReturnType<typeof calculateStats>
  trend: ReturnType<typeof calculateTrend>
}

export function StatsDashboard({ stats, trend }: StatsDashboardProps) {
  return (
    <section className="stats-page" aria-label="Stats dashboard">
      <div className="stats-hero card">
        <div className="stats-hero-copy">
          <span className="stats-kicker"><Sparkles size={16} /> 7-day family rhythm</span>
          <h2>{stats.recentEntries.length ? `${stats.recentEntries.length} feeds, beautifully tracked` : 'A beautiful stats story starts here'}</h2>
          <p>{stats.recentEntries.length ? `A calm snapshot of feeding cadence, balance, bottles, and those tiny overnight hero moments.` : 'Log a few feeds and this page turns into a polished readout of your baby’s feeding rhythm.'}</p>
        </div>
        <div className="orbital-stat" aria-label="Weekly feeds"><strong>{stats.recentEntries.length}</strong><span>feeds this week</span></div>
      </div>

      <div className="insight-grid">
        <article className="insight-card primary-insight"><Clock3 size={19} /><span>Average spacing</span><strong>{stats.avgGap ? formatDuration(stats.avgGap) : '—'}</strong><small>between recent feeds</small></article>
        <article className="insight-card"><Droplets size={19} /><span>Total bottle</span><strong>{stats.totalBottle.toFixed(1)} oz</strong><small>{stats.bottleFeeds} bottle feeds this week</small></article>
        <article className="insight-card"><Baby size={19} /><span>Avg nursing</span><strong>{stats.avgNursing ? formatDuration(stats.avgNursing) : '—'}</strong><small>per nursing feed</small></article>
        <article className="insight-card"><Trophy size={19} /><span>Busiest day</span><strong>{stats.bestDay.label}</strong><small>{stats.bestDay.count} feeds logged</small></article>
        <article className="insight-card"><Activity size={19} /><span>24h momentum</span><strong>{stats.last24Entries.length}</strong><small>{stats.momentumLabel}</small></article>
        <article className="insight-card"><Waves size={19} /><span>Longest stretch</span><strong>{stats.longestGapLabel}</strong><small>between feeds this week</small></article>
        <article className="insight-card"><HeartPulse size={19} /><span>Longest nursing</span><strong>{stats.longestNursing ? formatDuration(stats.longestNursing) : '—'}</strong><small>single feed stamina</small></article>
        <article className="insight-card"><Target size={19} /><span>Next side cue</span><strong>{stats.nextSideLabel}</strong><small>{stats.balanceLabel}</small></article>
      </div>

      <section className="stats-story-grid">
        <article className="card story-card glow-story">
          <span className="stats-kicker"><Sparkles size={15} /> Smart read</span>
          <h2>{stats.recentEntries.length ? `${stats.avgFeedsPerDay} feeds/day cadence` : 'Cadence will appear here'}</h2>
          <p>{stats.recentEntries.length ? `The last 24 hours logged ${stats.last24Entries.length} feeds, with the longest calm stretch at ${stats.longestGapLabel}.` : 'Once feeds are logged, this card summarizes pace, recovery windows, and the shape of the week.'}</p>
        </article>
        <article className="card diaper-signal-card">
          <div><span className="muted">Diaper signal</span><div className="diaper-signal-values"><strong>{stats.wetCount}<small>wet</small></strong><strong>{stats.stoolCount}<small>stool</small></strong></div></div>
          <p>Logged alongside feeds and standalone changes for a cleaner weekly care picture.</p>
        </article>
      </section>

      <section className="card rhythm-card">
        <div className="section-heading"><h2>Feeding rhythm</h2><span className="muted">Last 7 days</span></div>
        <div className="rhythm-bars">{trend.days.map((day) => <div key={day.label} className="rhythm-day"><div className="rhythm-track"><div style={{ height: `${Math.max(10, (day.count / trend.max) * 100)}%` }} /></div><strong>{day.count}</strong><span>{day.label}</span></div>)}</div>
      </section>

      <section className="stats-split">
        <article className="card balance-card">
          <div className="section-heading"><h2>Side balance</h2><span className="muted">L / R</span></div>
          <div className="balance-orb" style={{ '--left': `${stats.leftPercent}%` } as CSSProperties}><strong>{stats.leftPercent}%</strong><span>left</span></div>
          <div className="balance-labels"><span>L {formatDuration(stats.totalLeft)}</span><span>R {formatDuration(stats.totalRight)}</span></div>
        </article>
        <article className="card night-card">
          <CalendarDays size={22} />
          <h2>Night watch</h2>
          <strong>{stats.nightFeeds}</strong>
          <p>feeds logged between 10 PM and 6 AM this week.</p>
        </article>
      </section>
    </section>
  )
}
