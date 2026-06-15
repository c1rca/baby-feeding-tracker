import { formatDuration } from './feedingUtils'
import { sideLabel } from './labels'
import { DAY_MS } from './time'
import type { DiaperEvent, DiaperKind, Entry } from '../types'
import { calculateSuggestedSide } from './statsSummary'
import {
  allTimeDayCount,
  averageGapSeconds,
  bottleOunces,
  collectDiaperSignals,
  countDiaperKind,
  entriesSince,
  longestGapMs,
  nursingSeconds,
  roundTenth,
  startOfDayMs,
} from './statsUtils'

const calculateDiaperAverages = (
  entries: Entry[],
  diapers: DiaperEvent[],
  dayStartMs: number,
  today: { wet: number; stool: number },
  wetCount: number,
  stoolCount: number,
) => {
  const allDiaperSignals = collectDiaperSignals(diapers, entries)
  const allTimeDays = allTimeDayCount(allDiaperSignals, dayStartMs)
  const countAllTime = (kind: DiaperKind) => allDiaperSignals.filter((signal) => signal.kind === kind).length

  return {
    wet: { today: today.wet, weekly: roundTenth(wetCount / 7), allTime: roundTenth(countAllTime('wet') / allTimeDays) },
    stool: { today: today.stool, weekly: roundTenth(stoolCount / 7), allTime: roundTenth(countAllTime('stool') / allTimeDays) },
  }
}

export const calculateStats = (
  entries: Entry[],
  diapers: DiaperEvent[],
  now: number,
  today: { left: number; right: number; wet: number; stool: number },
  trendDays: { label: string; count: number }[],
) => {
  const dayStartMs = startOfDayMs(now)
  const weekStart = dayStartMs - 6 * DAY_MS
  const recentEntries = entriesSince(entries, weekStart)
  const totalNursing = recentEntries.reduce((sum, entry) => sum + nursingSeconds(entry), 0)
  const totalBottle = recentEntries.reduce((sum, entry) => sum + bottleOunces(entry), 0)
  const nursingFeeds = recentEntries.filter((entry) => nursingSeconds(entry) > 0)
  const avgNursing = nursingFeeds.length ? Math.round(totalNursing / nursingFeeds.length) : 0
  const totalLeft = recentEntries.reduce((sum, entry) => sum + entry.leftSeconds, 0)
  const totalRight = recentEntries.reduce((sum, entry) => sum + entry.rightSeconds, 0)
  const balanceTotal = Math.max(1, totalLeft + totalRight)
  const leftPercent = Math.round((totalLeft / balanceTotal) * 100)
  const bestDay = trendDays.reduce((best, day) => (day.count > best.count ? day : best), trendDays[0] ?? { label: '—', count: 0 })
  const avgGap = averageGapSeconds(recentEntries)
  const nightFeeds = recentEntries.filter((entry) => {
    const hour = new Date(entry.endedAt).getHours()
    return hour < 6 || hour >= 22
  }).length
  const last24Entries = entriesSince(entries, now - DAY_MS)
  const avgFeedsPerDay = recentEntries.length ? roundTenth(recentEntries.length / 7) : 0
  const longestNursing = nursingFeeds.reduce((max, entry) => Math.max(max, nursingSeconds(entry)), 0)
  const longestGap = longestGapMs(recentEntries)
  const bottleFeeds = recentEntries.filter((entry) => bottleOunces(entry) > 0).length
  const wetCount = countDiaperKind(diapers, recentEntries, 'wet', weekStart)
  const stoolCount = countDiaperKind(diapers, recentEntries, 'stool', weekStart)
  const sideDelta = Math.abs(totalLeft - totalRight)

  return {
    recentEntries,
    totalNursing,
    totalBottle,
    avgNursing,
    totalLeft,
    totalRight,
    leftPercent,
    bestDay,
    avgGap,
    nightFeeds,
    last24Entries,
    avgFeedsPerDay,
    longestNursing,
    longestGap,
    longestGapLabel: longestGap ? formatDuration(Math.round(longestGap / 1000)) : '—',
    bottleFeeds,
    wetCount,
    stoolCount,
    diaperAverages: calculateDiaperAverages(entries, diapers, dayStartMs, today, wetCount, stoolCount),
    balanceLabel: sideDelta < 5 * 60 ? 'Beautifully balanced' : totalLeft > totalRight ? 'Left leading' : 'Right leading',
    nextSideLabel: sideLabel(calculateSuggestedSide(entries, today)),
    momentumLabel: last24Entries.length >= avgFeedsPerDay ? 'Above weekly pace' : last24Entries.length ? 'Below weekly pace' : 'Quiet 24h',
  }
}
