import { formatDuration } from './feedingUtils'
import { sideLabel } from './labels'
import { TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES, isTummyTimeEvent, normalizeTummyTimeGoalMinutes, tummyTimeMinutes, tummyTimeMinutesToday } from './tummyTime'
import { DAY_MS, localDayWindows } from './time'
import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, TummyTimeEvent } from '../types'
import { calculateDiaperAverages } from './statsDiapers'
import { calculateSuggestedSide } from './statsSummary'
import {
  averageGapSeconds,
  bottleOunces,
  countDiaperKind,
  entriesSince,
  longestGapMs,
  nursingSeconds,
  roundTenth,
  startOfDayMs,
} from './statsUtils'

// `rangeDays` is the length of the trailing window every aggregate is computed
// over. It used to be a hard-coded 7; the stats dashboard now lets a caregiver
// widen it, so every per-day average divides by this rather than by a literal.
export const calculateStats = (
  entries: Entry[],
  diapers: DiaperEvent[],
  medicines: MedicineEvent[],
  now: number,
  today: { left: number; right: number; wet: number; stool: number },
  trendDays: { label: string; count: number }[],
  tummyTimes: TummyTimeEvent[] = [],
  tummyGoalMinutes = TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES,
  { pumpEvents = [], rangeDays = 7 }: { pumpEvents?: PumpEvent[]; rangeDays?: number } = {},
) => {
  const tummyDailyGoalMinutes = normalizeTummyTimeGoalMinutes(tummyGoalMinutes)
  const dayStartMs = startOfDayMs(now)
  const weekWindows = localDayWindows(now, rangeDays)
  const weekStart = weekWindows[0]?.startMs ?? dayStartMs - (rangeDays - 1) * DAY_MS
  const recentEntries = entriesSince(entries, weekStart)
  const totalNursing = recentEntries.reduce((sum, entry) => sum + nursingSeconds(entry), 0)
  const totalBottle = recentEntries.reduce((sum, entry) => sum + bottleOunces(entry), 0)
  const nursingFeeds = recentEntries.filter((entry) => nursingSeconds(entry) > 0)
  const avgNursing = nursingFeeds.length ? Math.round(totalNursing / nursingFeeds.length) : 0
  const totalLeft = recentEntries.reduce((sum, entry) => sum + entry.leftSeconds, 0)
  const totalRight = recentEntries.reduce((sum, entry) => sum + entry.rightSeconds, 0)
  const balanceTotal = Math.max(1, totalLeft + totalRight)
  const leftPercent = Math.round((totalLeft / balanceTotal) * 100)
  const bestDay = trendDays.reduce((best, day) => (day.count > best.count ? day : best), trendDays[0] ?? { label: 'Not yet', count: 0 })
  const avgGap = averageGapSeconds(recentEntries)
  const isOvernight = (endedAt: number) => {
    const hour = new Date(endedAt).getHours()
    return hour < 6 || hour >= 22
  }
  const nightFeeds = recentEntries.filter((entry) => isOvernight(entry.endedAt)).length
  const nightByDay = weekWindows.map((window, index) => {
    const count = recentEntries.filter(
      (entry) => entry.endedAt >= window.startMs && entry.endedAt < window.endMs && isOvernight(entry.endedAt),
    ).length
    return { label: trendDays[index]?.label ?? window.label, count, startMs: window.startMs }
  })
  const nightAvgPerNight = roundTenth(nightFeeds / rangeDays)
  const nightShare = recentEntries.length ? Math.round((nightFeeds / recentEntries.length) * 100) : 0
  const nightBusiest = nightByDay.reduce(
    (best, day) => (day.count > best.count ? day : best),
    nightByDay[0] ?? { label: 'Not yet', count: 0 },
  )
  const last24Entries = entriesSince(entries, now - DAY_MS)
  const avgFeedsPerDay = recentEntries.length ? roundTenth(recentEntries.length / rangeDays) : 0
  const longestNursing = nursingFeeds.reduce((max, entry) => Math.max(max, nursingSeconds(entry)), 0)
  const longestGap = longestGapMs(recentEntries)
  const bottleFeeds = recentEntries.filter((entry) => bottleOunces(entry) > 0).length
  // Bottles logged before content was tracked stay in `unlabelled` rather than
  // being counted as either milk source.
  const bottleByContent = recentEntries.reduce(
    (totals, entry) => {
      const amount = bottleOunces(entry)
      if (amount <= 0) return totals
      const key = entry.bottleContent ?? 'unlabelled'
      totals[key] = roundTenth((totals[key] ?? 0) + amount)
      return totals
    },
    {} as Record<string, number>,
  )
  const wetCount = countDiaperKind(diapers, recentEntries, 'wet', weekStart)
  const stoolCount = countDiaperKind(diapers, recentEntries, 'stool', weekStart)
  const sideDelta = Math.abs(totalLeft - totalRight)
  const feedingHoursByDay = weekWindows.map((window, index) => {
    const day = trendDays[index]
    const seconds = recentEntries
      .filter((entry) => entry.endedAt >= window.startMs && entry.endedAt < window.endMs)
      .reduce((sum, entry) => sum + nursingSeconds(entry), 0)
    return { label: day?.label ?? window.label, seconds, hours: roundTenth(seconds / 3600), startMs: window.startMs, endMs: window.endMs }
  })
  const maxFeedingSeconds = Math.max(1, ...feedingHoursByDay.map((day) => day.seconds))
  const avgFeedingHoursPerDay = roundTenth(totalNursing / 3600 / rangeDays)
  const recentMedicines = medicines.filter((medicine) => medicine.at >= weekStart)
  const vitaminDDosesThisWeek = recentMedicines.filter((medicine) => medicine.kind === 'vitamin_d').length
  const latestVitaminD = medicines
    .filter((medicine) => medicine.kind === 'vitamin_d' && Number.isFinite(medicine.at))
    .sort((a, b) => b.at - a.at)[0] ?? null
  const vitaminDTakenToday = Boolean(latestVitaminD && latestVitaminD.at >= dayStartMs)
  const recentTummyTimes = tummyTimes.filter((event) => isTummyTimeEvent(event) && event.startedAt >= weekStart)
  const tummyMinutesToday = tummyTimeMinutesToday(tummyTimes, now)
  const tummyTotalMinutes = tummyTimeMinutes(recentTummyTimes)
  const tummyDays = weekWindows.map((window) => {
    const minutes = tummyTimeMinutes(tummyTimes.filter((event) => isTummyTimeEvent(event) && event.startedAt >= window.startMs && event.startedAt < window.endMs))
    return { label: window.label, minutes, goalPercent: Math.min(100, Math.round((minutes / tummyDailyGoalMinutes) * 100)), startMs: window.startMs, endMs: window.endMs }
  })
  const tummyGoalPercentToday = Math.min(100, Math.round((tummyMinutesToday / tummyDailyGoalMinutes) * 100))
  const tummyGoalDays = tummyDays.filter((day) => day.minutes >= tummyDailyGoalMinutes).length
  const tummyAverageMinutesPerDay = roundTenth(tummyTotalMinutes / rangeDays)
  const tummyBestDay = tummyDays.reduce((best, day) => (day.minutes > best.minutes ? day : best), tummyDays[0] ?? { label: 'Not yet', minutes: 0, goalPercent: 0 })

  // Pumping output is the metric pumping parents actually track: total volume
  // collected per day, not session count.
  const pumpOutputOunces = (event: PumpEvent) => (event.leftOunces ?? 0) + (event.rightOunces ?? 0)
  const recentPumpEvents = pumpEvents.filter((event) => event.startedAt >= weekStart)
  const pumpTotalOunces = recentPumpEvents.reduce((sum, event) => sum + pumpOutputOunces(event), 0)
  const pumpDays = weekWindows.map((window) => {
    const dayEvents = pumpEvents.filter((event) => event.startedAt >= window.startMs && event.startedAt < window.endMs)
    return {
      label: window.label,
      ounces: roundTenth(dayEvents.reduce((sum, event) => sum + pumpOutputOunces(event), 0)),
      sessions: dayEvents.length,
      startMs: window.startMs,
      endMs: window.endMs,
    }
  })
  const pumpMaxOunces = Math.max(0.1, ...pumpDays.map((day) => day.ounces))
  const pumpBestDay = pumpDays.reduce((best, day) => (day.ounces > best.ounces ? day : best), pumpDays[0] ?? { label: 'Not yet', ounces: 0, sessions: 0 })
  const pumpTodayOunces = roundTenth(pumpDays.at(-1)?.ounces ?? 0)
  const pumpLeftOunces = recentPumpEvents.reduce((sum, event) => sum + (event.leftOunces ?? 0), 0)
  const pumpRightOunces = recentPumpEvents.reduce((sum, event) => sum + (event.rightOunces ?? 0), 0)

  return {
    rangeDays,
    rangeLabel: `${rangeDays} days`,
    pumpSessions: recentPumpEvents.length,
    pumpTotalOunces: roundTenth(pumpTotalOunces),
    pumpAverageOuncesPerDay: roundTenth(pumpTotalOunces / rangeDays),
    pumpAverageOuncesPerSession: recentPumpEvents.length ? roundTenth(pumpTotalOunces / recentPumpEvents.length) : 0,
    pumpDays,
    pumpMaxOunces,
    pumpBestDay,
    pumpTodayOunces,
    pumpLeftOunces: roundTenth(pumpLeftOunces),
    pumpRightOunces: roundTenth(pumpRightOunces),
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
    nightByDay,
    nightAvgPerNight,
    nightShare,
    nightBusiest,
    last24Entries,
    avgFeedsPerDay,
    longestNursing,
    longestGap,
    longestGapLabel: longestGap ? formatDuration(Math.round(longestGap / 1000)) : 'Not yet',
    bottleFeeds,
    bottleByContent,
    wetCount,
    stoolCount,
    diaperAverages: calculateDiaperAverages(entries, diapers, dayStartMs, today, wetCount, stoolCount, rangeDays),
    vitaminDDosesThisWeek,
    latestVitaminD,
    vitaminDTakenToday,
    tummyMinutesToday,
    tummyDailyGoalMinutes,
    tummyTotalMinutes,
    tummyGoalPercentToday,
    tummyGoalDays,
    tummyAverageMinutesPerDay,
    tummyBestDay,
    tummyDays,
    feedingHoursByDay,
    maxFeedingSeconds,
    avgFeedingHoursPerDay,
    balanceLabel: sideDelta < 5 * 60 ? 'Beautifully balanced' : totalLeft > totalRight ? 'Left leading' : 'Right leading',
    nextSideLabel: sideLabel(calculateSuggestedSide(entries, today)),
    momentumLabel: last24Entries.length >= avgFeedsPerDay ? 'Above weekly pace' : last24Entries.length ? 'Below weekly pace' : 'Quiet 24h',
  }
}
