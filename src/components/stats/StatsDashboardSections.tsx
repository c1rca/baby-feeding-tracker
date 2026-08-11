/* eslint-disable react-refresh/only-export-components -- chart hook belongs with its chart controls. */
import { useState, type CSSProperties } from 'react'
import { Activity, Baby, ChartColumn, ChartLine, Clock3, Droplets, HeartPulse, MoonStar, Target, Trophy, TrendingUp, Waves } from 'lucide-react'
import { formatDuration } from '../../domain/feedingUtils'
import { useUnits } from '../../state/unitPreferencesContext'
import { formatVolume, formatVolumeValue, type VolumeUnit } from '../../domain/units'
import { BOTTLE_CONTENTS, bottleContentLabel } from '../../domain/labels'
import type { calculateStats, calculateTrend } from '../../domain/trackerDomain'
import { customTrackerHueToken, type CustomTrackerStats } from '../../domain/customTrackers'
import { CustomTrackerIcon } from '../customTrackerIcons'

type Stats = ReturnType<typeof calculateStats>
type Trend = ReturnType<typeof calculateTrend>

const formatAverage = (value: number) => value.toFixed(1)

type RangePoint = { label: string; startMs: number; value: number }

// Past this many days a bar per day stops being readable: the bars are a few
// pixels wide, adjacent days of similar height merge into one block, and there
// is no room for a value or a label. The same series as a trend line keeps its
// shape and gets gridlines and an axis, which is what a month of data needs.
const DAY_BAR_LIMIT = 14

// Share of each band left as breathing room between bars.
const BAR_GAP = 0.34

export type ChartMode = 'line' | 'bar'

const CHART_MODE_KEY = 'baby-feeding-tracker:v1:chart-mode'

/**
 * Which shape a range chart is drawn in, remembered per chart.
 *
 * A trend line reads the shape of a month; bars read the size of each day. Both
 * are legitimate for the same series, so it is a preference rather than
 * something to decide on the caregiver's behalf by range length.
 */
export function useChartMode(chartId: string, fallback: ChartMode = 'line') {
  const [mode, setMode] = useState<ChartMode>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CHART_MODE_KEY) || '{}')
      return stored?.[chartId] === 'bar' || stored?.[chartId] === 'line' ? stored[chartId] : fallback
    } catch {
      return fallback
    }
  })
  const choose = (next: ChartMode) => {
    setMode(next)
    try {
      const stored = JSON.parse(localStorage.getItem(CHART_MODE_KEY) || '{}')
      localStorage.setItem(CHART_MODE_KEY, JSON.stringify({ ...stored, [chartId]: next }))
    } catch {
      // A full or blocked storage must not stop the chart from switching.
    }
  }
  return [mode, choose] as const
}

export function ChartModeToggle({ mode, onChange, label }: { mode: ChartMode; onChange: (mode: ChartMode) => void; label: string }) {
  return (
    <div className="range-mode-toggle" role="group" aria-label={`${label} chart style`}>
      <button type="button" aria-pressed={mode === 'line'} aria-label={`${label} as a line chart`} title="Line" onClick={() => onChange('line')}><ChartLine size={14} /></button>
      <button type="button" aria-pressed={mode === 'bar'} aria-label={`${label} as a bar chart`} title="Bars" onClick={() => onChange('bar')}><ChartColumn size={14} /></button>
    </div>
  )
}

/**
 * One instrument, two shapes. Line and bar modes share the readout, y-axis,
 * gridlines, hover banding, tooltip and x-axis labels — only the series itself
 * differs — so switching cannot land you on a chart that feels less finished
 * than the one you left.
 *
 * Bars are positioned elements rather than SVG rects: the plot is drawn with
 * `preserveAspectRatio="none"`, which would squash a rect's rounded corners
 * horizontally.
 */
function RangeChart({ points, unit, accent, ariaLabel, mode = 'line' }: { points: RangePoint[]; unit: string; accent: 'berry' | 'violet' | 'tummy' | 'pumping' | 'custom'; ariaLabel: string; mode?: ChartMode }) {
  const width = 760
  const height = 190
  const inset = { top: 18, right: 14, bottom: 34, left: 48 }
  const chartHeight = height - inset.top - inset.bottom
  const chartWidth = width - inset.left - inset.right
  const max = Math.max(1, ...points.map((point) => point.value))
  const [selectedStartMs, setSelectedStartMs] = useState<number | null>(null)
  const selectedIndex = points.findIndex((point) => point.startMs === selectedStartMs)
  const resolvedSelectedIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, points.length - 1)
  const selected = points[resolvedSelectedIndex] ?? points.at(-1)

  // Line mode places points on the edges of the plot; bar mode gives each day a
  // band and centres its bar in it, so neither end is half cut off.
  const band = chartWidth / Math.max(1, points.length)
  const x = (index: number) => mode === 'bar'
    ? inset.left + band * (index + 0.5)
    : inset.left + (index / Math.max(1, points.length - 1)) * chartWidth
  const y = (value: number) => inset.top + chartHeight - (value / max) * chartHeight
  const hoverBandPercent = mode === 'bar'
    ? (band / width) * 100
    : (points.length > 1 ? (chartWidth / (points.length - 1) / width) * 100 : 100)

  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.value)}`).join(' ')
  const area = points.length ? `${line} L ${x(points.length - 1)} ${inset.top + chartHeight} L ${x(0)} ${inset.top + chartHeight} Z` : ''
  const labelIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])).filter((index) => index >= 0)
  const dateLabel = (point: RangePoint) => new Date(point.startMs).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const valueLabel = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`
  const plotTopPercent = (inset.top / height) * 100
  const plotHeightPercent = (chartHeight / height) * 100

  return (
    <div className={`range-trend-chart range-trend-chart--${accent} is-${mode}`} aria-label={ariaLabel}>
      {selected ? <div className="range-selected-value" role="status"><span>{dateLabel(selected)}</span><strong>{valueLabel(selected.value)}</strong><small>Hover, focus, or tap to inspect</small></div> : null}
      <div className="range-plot">
        <div className="range-y-axis" aria-hidden="true"><span>{valueLabel(max)}</span><span>{valueLabel(max / 2)}</span><span>0</span></div>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`range-fill-${accent}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity=".24" />
              <stop offset="1" stopColor="currentColor" stopOpacity=".02" />
            </linearGradient>
          </defs>
          {[0, .5, 1].map((ratio) => <line key={ratio} className="range-grid-line" x1={inset.left} x2={width - inset.right} y1={inset.top + chartHeight * ratio} y2={inset.top + chartHeight * ratio} />)}
          {mode === 'line' ? (
            <>
              <path className="range-area" d={area} fill={`url(#range-fill-${accent})`} />
              {selected ? <line className="range-crosshair" x1={x(resolvedSelectedIndex)} x2={x(resolvedSelectedIndex)} y1={inset.top} y2={inset.top + chartHeight} /> : null}
              <path className="range-line" d={line} />
              {points.map((point, index) => <circle key={point.startMs} className={`range-point${index === resolvedSelectedIndex ? ' is-selected' : ''}`} cx={x(index)} cy={y(point.value)} r={index === resolvedSelectedIndex ? 6 : 3} />)}
            </>
          ) : null}
        </svg>
        {mode === 'bar' ? (
          <div className="range-bars" aria-hidden="true" style={{ top: `${plotTopPercent}%`, height: `${plotHeightPercent}%` }}>
            {points.map((point, index) => (
              <div
                key={point.startMs}
                className={`range-bar${index === resolvedSelectedIndex ? ' is-selected' : ''}${point.value === 0 ? ' is-empty' : ''}`}
                // The gap is computed here, not with percentage padding: a
                // percentage padding resolves against the container's width, so
                // every bar was inset by ~18% of the whole plot.
                style={{
                  left: `${((inset.left + band * index + band * BAR_GAP / 2) / width) * 100}%`,
                  width: `${((band * (1 - BAR_GAP)) / width) * 100}%`,
                  height: `${(point.value / max) * 100}%`,
                }}
              />
            ))}
          </div>
        ) : null}
        {selected ? <div className="range-chart-tooltip" aria-hidden="true" style={{ left: `${(x(resolvedSelectedIndex) / width) * 100}%`, top: `${(y(selected.value) / height) * 100}%` }}>{valueLabel(selected.value)}</div> : null}
        {/* One full-height band per point, tiled exactly so they cannot overlap.
            The old targets were a fixed 38px wide and followed the line's y as
            well: at thirty points, 17px apart, that left 29 overlapping pairs,
            so whichever happened to be stacked on top won and the selection
            jumped as the pointer moved. Banding by column makes hover
            positional and predictable — and easy to hit anywhere in the plot,
            not only near the line. */}
        <div className="range-point-controls">
          {points.map((point, index) => (
            <button
              key={point.startMs}
              type="button"
              className="range-point-control"
              style={{ left: `${(((mode === 'bar' ? inset.left + band * index : x(index))) / width) * 100}%`, width: `${hoverBandPercent}%`, transform: mode === 'bar' ? 'none' : undefined }}
              aria-label={`${dateLabel(point)}: ${valueLabel(point.value)}`}
              aria-pressed={index === resolvedSelectedIndex}
              onPointerEnter={() => setSelectedStartMs(point.startMs)}
              onFocus={() => setSelectedStartMs(point.startMs)}
              onClick={() => setSelectedStartMs(point.startMs)}
            />
          ))}
        </div>
        <div className="range-axis" aria-hidden="true">{labelIndexes.map((index) => <span key={points[index].startMs} style={{ left: `${(x(index) / width) * 100}%` }}>{dateLabel(points[index])}</span>)}</div>
      </div>
    </div>
  )
}

const RangeTrendChart = RangeChart

type InteractiveDay = { label: string; startMs: number }

function InteractiveDayBars<T extends InteractiveDay,>({ days, ariaLabel, className, valueForDay, formatValue, trackStyle }: { days: T[]; ariaLabel: string; className: string; valueForDay: (day: T) => number; formatValue: (value: number) => string; trackStyle: (day: T) => CSSProperties }) {
  const [selectedStartMs, setSelectedStartMs] = useState<number | null>(null)
  const selectedIndex = days.findIndex((day) => day.startMs === selectedStartMs)
  const resolvedSelectedIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, days.length - 1)
  const selected = days[resolvedSelectedIndex] ?? days.at(-1)
  const dateLabel = (day: T) => new Date(day.startMs).toLocaleDateString([], { month: 'short', day: 'numeric' })

  // A 30-day range cannot show what a 7-day range shows: at thirty columns each
  // bar is a few pixels wide, so a per-bar value has nowhere to go and thirty
  // labels cannot be read at once. The hover readout already names the selected
  // day and its value, which is what lets the bars themselves thin out.
  const density = days.length > 20 ? 'high' : days.length > 10 ? 'medium' : 'low'

  return (
    <div className={`interactive-day-bars ${className}`} aria-label={ariaLabel} style={{ '--day-count': days.length } as CSSProperties}>
      {selected ? <div className="bar-selected-value" role="status"><span>{dateLabel(selected)}</span><strong>{formatValue(valueForDay(selected))}</strong><small>Hover, focus, or tap a bar to inspect</small></div> : null}
      {/* `stat-bars` carries the column track, gutter and axis rule, so it
          belongs on the list of bars. On the wrapper it made the readout and
          the list two cells of a seven-column grid: the bars collapsed on top
          of each other and every day label printed in the same place. */}
      <div className="interactive-day-bar-list stat-bars" data-density={density}>
        {days.map((day, index) => {
          const value = valueForDay(day)
          const isSelected = index === resolvedSelectedIndex
          return <button key={day.startMs} type="button" className={`stat-bar-day ${className.replace('-bars', '-day')}${isSelected ? ' is-selected' : ''}`} aria-label={`${dateLabel(day)}: ${formatValue(value)}`} aria-pressed={isSelected} onPointerEnter={() => setSelectedStartMs(day.startMs)} onFocus={() => setSelectedStartMs(day.startMs)} onClick={() => setSelectedStartMs(day.startMs)}>
            <span className="stat-bar-track"><span style={trackStyle(day)} /></span>
            <strong>{value ? formatValue(value) : ''}</strong>
            <span className="stat-bar-label">{day.label}</span>
          </button>
        })}
      </div>
    </div>
  )
}

function InteractiveNightHeatmap({ days, ariaLabel, max }: { days: Array<InteractiveDay & { count: number }>; ariaLabel: string; max: number }) {
  const [selectedStartMs, setSelectedStartMs] = useState<number | null>(null)
  const selectedIndex = days.findIndex((day) => day.startMs === selectedStartMs)
  const resolvedSelectedIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, days.length - 1)
  const selected = days[resolvedSelectedIndex] ?? days.at(-1)
  const dateLabel = (day: InteractiveDay) => new Date(day.startMs).toLocaleDateString([], { month: 'short', day: 'numeric' })

  return (
    <div className="night-heatmap" role="group" aria-label={ariaLabel}>
      {selected ? <div className="night-selected-value" role="status"><span>{dateLabel(selected)}</span><strong>{selected.count} overnight {selected.count === 1 ? 'feed' : 'feeds'}</strong><small>Hover, focus, or tap a night to inspect</small></div> : null}
      <div className="night-heatmap-days">
        {days.map((day, index) => <button key={day.startMs} type="button" className={`night-heatmap-day${index === resolvedSelectedIndex ? ' is-selected' : ''}`} aria-label={`${dateLabel(day)}: ${day.count} overnight ${day.count === 1 ? 'feed' : 'feeds'}`} aria-pressed={index === resolvedSelectedIndex} onPointerEnter={() => setSelectedStartMs(day.startMs)} onFocus={() => setSelectedStartMs(day.startMs)} onClick={() => setSelectedStartMs(day.startMs)}>
          <span className="night-heatmap-cell" style={{ '--night-fill': `${5 + (day.count / max) * 75}%`, '--night-border': `${12 + (day.count / max) * 32}%` } as CSSProperties}>{day.count || '·'}</span>
          <small>{new Date(day.startMs).toLocaleDateString([], { day: 'numeric' })}</small>
        </button>)}
      </div>
    </div>
  )
}

function changeFromPreviousWeek(values: number[]) {
  if (values.length < 14) return null
  const current = values.slice(-7).reduce((sum, value) => sum + value, 0)
  const previous = values.slice(-14, -7).reduce((sum, value) => sum + value, 0)
  if (!previous) return current ? 'New this week' : 'No change'
  const change = Math.round(((current - previous) / previous) * 100)
  return `${change > 0 ? '+' : ''}${change}% vs prior week`
}

// Only worth saying when the bottles were actually labelled with contents.
function bottleContentSummary(stats: Stats, volumeUnit: VolumeUnit) {
  const labelled = BOTTLE_CONTENTS.filter((content) => (stats.bottleByContent[content] ?? 0) > 0)
  if (!labelled.length) return null
  return labelled.map((content) => `${bottleContentLabel(content)} ${formatVolume(stats.bottleByContent[content], volumeUnit)}`).join(' · ')
}

export function InsightGrid({ stats }: { stats: Stats }) {
  const { units } = useUnits()
  return (
    <div className="insight-grid">
      <article className="insight-card primary-insight"><Clock3 size={19} /><span>Average spacing</span><strong>{stats.avgGap ? formatDuration(stats.avgGap) : 'Not yet'}</strong><small>between recent feeds</small></article>
      <article className="insight-card"><Droplets size={19} /><span>Total bottle</span><strong>{formatVolume(stats.totalBottle, units.volume)}</strong><small>{bottleContentSummary(stats, units.volume) ?? `${stats.bottleFeeds} bottle feeds in ${stats.rangeLabel}`}</small></article>
      <article className="insight-card"><Baby size={19} /><span>Avg nursing</span><strong>{stats.avgNursing ? formatDuration(stats.avgNursing) : 'Not yet'}</strong><small>per nursing feed</small></article>
      <article className="insight-card"><Trophy size={19} /><span>Busiest day</span><strong>{stats.bestDay.label}</strong><small>{stats.bestDay.count} feeds logged</small></article>
      <article className="insight-card"><Activity size={19} /><span>24h momentum</span><strong>{stats.last24Entries.length}</strong><small>{stats.momentumLabel}</small></article>
      <article className="insight-card"><Waves size={19} /><span>Longest stretch</span><strong>{stats.longestGapLabel}</strong><small>between feeds in {stats.rangeLabel}</small></article>
      <article className="insight-card"><HeartPulse size={19} /><span>Longest nursing</span><strong>{stats.longestNursing ? formatDuration(stats.longestNursing) : 'Not yet'}</strong><small>single feed stamina</small></article>
      <article className="insight-card"><Target size={19} /><span>Next side cue</span><strong>{stats.nextSideLabel}</strong><small>{stats.balanceLabel}</small></article>
    </div>
  )
}

export function StatsStoryGrid({ stats }: { stats: Stats }) {
  return (
    <section className="stats-story-grid">
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
        <p>Averages cover the last {stats.rangeDays} days; mixed diapers count toward both signals.</p>
      </article>
      <article className="card diaper-signal-card vitamin-stats-card">
        <div><span className="stats-kicker">Vitamin D</span><div className="diaper-signal-values"><strong>{stats.vitaminDTakenToday ? '✓' : '0'}<small>{stats.vitaminDTakenToday ? 'Taken today' : 'Not today'}</small></strong><strong>{stats.vitaminDDosesThisWeek}<small>range</small></strong></div></div>
        <div className="diaper-average-grid" aria-label="Vitamin D summary">
          <div className="diaper-average-row">
            <span>Daily vitamin</span>
            <strong>{stats.vitaminDTakenToday ? 'Taken today' : 'Due today'}</strong>
            <small>{stats.vitaminDDosesThisWeek} {stats.vitaminDDosesThisWeek === 1 ? 'dose' : 'doses'} in {stats.rangeLabel}</small>
          </div>
        </div>
        <p>One dose a day, tracked across the selected range.</p>
      </article>
    </section>
  )
}

export function FeedingHoursCard({ stats }: { stats: Stats }) {
  const points = stats.feedingHoursByDay.map((day) => ({ ...day, value: day.hours }))
  const change = changeFromPreviousWeek(points.map((point) => point.value))
  const [mode, setMode] = useChartMode('feeding-hours')
  return (
    <section className="card stat-hero feeding-hours-card" aria-label="Daily feeding hours">
      <div className="stat-hero-copy feeding-hours-copy">
        <span className="stats-kicker">Time invested</span>
        <h2>{stats.totalNursing ? `${stats.avgFeedingHoursPerDay} hrs/day` : 'Hours per day will appear here'}</h2>
        <p>{stats.totalNursing ? `${formatDuration(stats.totalNursing)} of nursing time captured across the last ${stats.rangeDays} days.` : 'Log nursing sessions to see daily feeding-time intensity and patterns.'}</p>
      </div>
      <div className="range-chart-panel">
        <div className="range-chart-meta">
          <span>Daily nursing time</span>
          <div className="range-chart-meta-end">
            {change ? <strong><TrendingUp size={14} />{change}</strong> : null}
            <ChartModeToggle mode={mode} onChange={setMode} label="Daily nursing time" />
          </div>
        </div>
        <RangeChart points={points} unit=" hrs" accent="berry" mode={mode} ariaLabel={`Daily nursing time over ${stats.rangeDays} days`} />
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
          <p>{hasTummyTime ? `${stats.tummyTotalMinutes} minutes captured in ${stats.rangeLabel} · ${stats.tummyGoalDays} goal ${stats.tummyGoalDays === 1 ? 'day' : 'days'} hit.` : 'Log quick adds or use the timer to see daily progress, weekly consistency, and best-day momentum.'}</p>
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
      {stats.tummyDays.length > DAY_BAR_LIMIT ? (
        <div className="range-chart-panel">
          <div className="range-chart-meta"><span>Daily tummy time</span></div>
          <RangeTrendChart
            points={stats.tummyDays.map((day) => ({ label: day.label, startMs: day.startMs, value: day.minutes }))}
            unit="m"
            accent="tummy"
            ariaLabel={`Daily tummy time over ${stats.rangeDays} days`}
          />
        </div>
      ) : (
        <InteractiveDayBars
          days={stats.tummyDays}
          ariaLabel={`Tummy Time last ${stats.rangeDays} days`}
          className="tummy-week-bars"
          valueForDay={(day) => day.minutes}
          formatValue={(value) => `${value}m`}
          trackStyle={(day) => ({ height: `${Math.max(day.minutes ? 12 : 0, day.goalPercent)}%` })}
        />
      )}
    </section>
  )
}

export function RhythmCard({ trend }: { trend: Trend }) {
  const total = trend.days.reduce((sum, day) => sum + day.count, 0)
  const avgPerDay = total ? (total / Math.max(1, trend.days.length)).toFixed(1) : '0'
  const peak = trend.days.reduce((best, day) => (day.count > best.count ? day : best), trend.days[0] ?? { label: '', count: 0 })
  const points = trend.days.map((day) => ({ ...day, value: day.count }))
  const change = changeFromPreviousWeek(points.map((point) => point.value))
  const [mode, setMode] = useChartMode('feeding-rhythm')
  return (
    <section className="card stat-hero rhythm-card" aria-label="Feeding rhythm">
      <div className="stat-hero-copy">
        <span className="stats-kicker">Feeding rhythm</span>
        <h2>{total ? `${avgPerDay} feeds/day` : 'Rhythm appears here'}</h2>
        <p>{total ? `${total} feeds across the last ${trend.days.length} days · busiest was ${peak.label} with ${peak.count}.` : 'Log feeds to see the shape of each day fill in across the week.'}</p>
      </div>
      <div className="range-chart-panel">
        <div className="range-chart-meta">
          <span>Feeds by day</span>
          <div className="range-chart-meta-end">
            {change ? <strong><TrendingUp size={14} />{change}</strong> : null}
            <ChartModeToggle mode={mode} onChange={setMode} label="Feeds by day" />
          </div>
        </div>
        <RangeChart points={points} unit=" feeds" accent="berry" mode={mode} ariaLabel={`Daily feed count over ${trend.days.length} days`} />
      </div>
    </section>
  )
}

export function BalanceAndNightCards({ stats }: { stats: Stats }) {
  const nightMax = Math.max(1, ...stats.nightByDay.map((day) => day.count))
  const activeNights = stats.nightByDay.filter((day) => day.count > 0).length
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
            <span>overnight {stats.nightFeeds === 1 ? 'feed' : 'feeds'} in {stats.rangeLabel}</span>
          </div>
        </div>
        <div className="night-metrics" aria-label="Night watch summary">
          <div><span>Per night</span><strong>{stats.nightAvgPerNight}</strong></div>
          <div><span>Share</span><strong>{stats.nightShare}%</strong></div>
          <div><span>Longest calm</span><strong>{stats.longestGapLabel}</strong></div>
        </div>
        <div className="night-chart-heading"><span>Night-by-night</span><strong>{activeNights} of {stats.rangeDays} nights</strong></div>
        <InteractiveNightHeatmap days={stats.nightByDay} max={nightMax} ariaLabel={`Overnight feeding activity across ${stats.rangeDays} nights`} />
      </article>
    </section>
  )
}

export function PumpingStatsCard({ stats }: { stats: Stats }) {
  const { units } = useUnits()
  const hasPumping = stats.pumpSessions > 0
  // The side split is the one pumping figure with no home in a bar chart, so it
  // becomes the card's orb — the same instrument the Tummy Time and feed
  // balance cards use, which is what makes the three read as one dashboard.
  const sidedOunces = stats.pumpLeftOunces + stats.pumpRightOunces
  const leftPercent = sidedOunces > 0 ? Math.round((stats.pumpLeftOunces / sidedOunces) * 100) : 50
  const showSplit = hasPumping && sidedOunces > 0
  return (
    <section className="card stat-hero pump-stats-card" aria-label="Pumping stats">
      <div className={`pump-stats-main${showSplit ? '' : ' is-flat'}`}>
        <div className="stat-hero-copy pump-stats-copy">
          <span className="stats-kicker">Pumping</span>
          <h2>{hasPumping ? `${formatVolume(stats.pumpAverageOuncesPerDay, units.volume)}/day` : 'Pumping output starts here'}</h2>
          <p>{hasPumping
            ? `${formatVolume(stats.pumpTotalOunces, units.volume)} collected across ${stats.pumpSessions} ${stats.pumpSessions === 1 ? 'session' : 'sessions'} in ${stats.rangeLabel}.`
            : 'Log a pumping session to see output per day, per session, and which side is producing more.'}</p>
        </div>
        {showSplit ? (
          <div className="pump-split-orb" style={{ '--left': `${leftPercent}%` } as CSSProperties} aria-label={`Side split: left ${leftPercent} percent, right ${100 - leftPercent} percent`}>
            <strong>{leftPercent}<i>%</i></strong>
            <span>left</span>
          </div>
        ) : null}
        <div className="pump-mini-stats" aria-label="Pumping summary">
          <div><span>Today</span><strong>{formatVolume(stats.pumpTodayOunces, units.volume)}</strong></div>
          <div><span>Per session</span><strong>{formatVolume(stats.pumpAverageOuncesPerSession, units.volume)}</strong></div>
          <div><span>Best day</span><strong>{stats.pumpBestDay.ounces ? `${stats.pumpBestDay.label} · ${formatVolume(stats.pumpBestDay.ounces, units.volume)}` : 'Not yet'}</strong></div>
          <div className="pump-split-tile"><span>L / R split</span><strong>{formatVolumeValue(stats.pumpLeftOunces, units.volume)} / {formatVolume(stats.pumpRightOunces, units.volume)}</strong></div>
        </div>
      </div>
      {stats.pumpDays.length > DAY_BAR_LIMIT ? (
        <div className="range-chart-panel">
          <div className="range-chart-meta"><span>Daily pumping output</span></div>
          <RangeTrendChart
            points={stats.pumpDays.map((day) => ({ label: day.label, startMs: day.startMs, value: day.ounces }))}
            unit={` ${units.volume}`}
            accent="pumping"
            ariaLabel={`Daily pumping output over ${stats.rangeDays} days`}
          />
        </div>
      ) : (
        <InteractiveDayBars
          days={stats.pumpDays}
          ariaLabel={`Pumping output last ${stats.rangeDays} days`}
          className="pump-week-bars"
          valueForDay={(day) => day.ounces}
          formatValue={(value) => formatVolume(value, units.volume)}
          trackStyle={(day) => ({ height: `${Math.max(day.ounces ? 12 : 0, (day.ounces / stats.pumpMaxOunces) * 100)}%` })}
        />
      )}
    </section>
  )
}

/**
 * A caregiver-defined tracker gets the same instruments as the built-in ones —
 * the day bars under a short range, the trend line over a long one — rather
 * than a lesser read-out. The tracker's own hue drives the chart, since
 * everything inside it inherits `currentColor`.
 */
export function CustomTrackerStatsCard({ stats: trackerStats, rangeDays }: { stats: CustomTrackerStats; rangeDays: number }) {
  const { tracker, days, unit, total, averagePerDay, goalDays, bestDay, target } = trackerStats
  const isDuration = tracker.goal.kind === 'duration'
  const noun = isDuration ? 'minutes' : total === 1 ? 'log' : 'logs'
  const today = days.at(-1)
  const todayPercent = today?.goalPercent ?? 0

  return (
    <section
      className="card stat-hero tummy-stats-card custom-tracker-stats-card"
      aria-label={`${tracker.name} stats`}
      style={{ '--need-hue': customTrackerHueToken(tracker.hue) } as CSSProperties}
    >
      <div className="tummy-stats-main">
        <div className="stat-hero-copy tummy-stats-copy">
          <span className="stats-kicker"><CustomTrackerIcon icon={tracker.icon} size={13} /> {tracker.name}</span>
          <h2>{total > 0 ? `${today?.value ?? 0}/${target}${unit} today` : `${tracker.name} starts here`}</h2>
          <p>{total > 0
            ? `${total} ${noun} in the last ${rangeDays} days · ${goalDays} goal ${goalDays === 1 ? 'day' : 'days'} hit.`
            : `Log it from Today's needs to see daily progress and consistency build up here.`}</p>
        </div>
        <div className="tummy-progress-orb" style={{ '--progress': `${todayPercent}%` } as CSSProperties} aria-label={`Today ${tracker.name} progress ${todayPercent}%`}>
          <strong>{todayPercent}%</strong>
          <span>today</span>
        </div>
        <div className="tummy-mini-stats" aria-label={`${tracker.name} summary`}>
          <div><span>Daily avg</span><strong>{averagePerDay}{unit}</strong></div>
          <div><span>Best day</span><strong>{bestDay.value ? `${bestDay.label} · ${bestDay.value}${unit}` : 'Not yet'}</strong></div>
        </div>
      </div>
      {days.length > DAY_BAR_LIMIT ? (
        <div className="range-chart-panel">
          <div className="range-chart-meta"><span>Daily {tracker.name.toLowerCase()}</span></div>
          <RangeTrendChart
            points={days.map((day) => ({ label: day.label, startMs: day.startMs, value: day.value }))}
            unit={unit}
            accent="custom"
            ariaLabel={`Daily ${tracker.name} over ${rangeDays} days`}
          />
        </div>
      ) : (
        <InteractiveDayBars
          days={days}
          ariaLabel={`${tracker.name} last ${rangeDays} days`}
          className="tummy-week-bars"
          valueForDay={(day) => day.value}
          formatValue={(value) => `${value}${unit}`}
          trackStyle={(day) => ({ height: `${Math.max(day.value ? 12 : 0, day.goalPercent)}%` })}
        />
      )}
    </section>
  )
}
