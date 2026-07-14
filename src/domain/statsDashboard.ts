import { formatDuration } from './feedingUtils'
import { sideLabel } from './labels'
import { TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES, normalizeTummyTimeGoalMinutes, tummyTimeDurationSeconds, tummyTimeMinutesToday } from './tummyTime'
import { DAY_MS, localDayWindows } from './time'
import type { DiaperEvent, Entry, MedicineEvent, TummyTimeEvent } from '../types'
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

export const calculateStats = (
  entries: Entry[],
  diapers: DiaperEvent[],
  medicines: MedicineEvent[],
  now: number,
  today: { left: number; right: number; wet: number; stool: number },
  trendDays: { label: string; count: number }[],
  tummyTimes: TummyTimeEvent[] = [],
  tummyGoalMinutes = TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES,
) => {
  const tummyDailyGoalMinutes = normalizeTummyTimeGoalMinutes(tummyGoalMinutes)
  const dayStartMs = startOfDayMs(now)
  const weekWindows = localDayWindows(now, 7)
  const weekStart = weekWindows[0]?.startMs ?? dayStartMs - 6 * DAY_MS
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
  const feedingHoursByDay = weekWindows.map((window, index) => {
    const day = trendDays[index]
    const seconds = recentEntries
      .filter((entry) => entry.endedAt >= window.startMs && entry.endedAt < window.endMs)
      .reduce((sum, entry) => sum + nursingSeconds(entry), 0)
    return { label: day?.label ?? window.label, seconds, hours: roundTenth(seconds / 3600), startMs: window.startMs, endMs: window.endMs }
  })
  const maxFeedingSeconds = Math.max(1, ...feedingHoursByDay.map((day) => day.seconds))
  const avgFeedingHoursPerDay = roundTenth(totalNursing / 3600 / 7)
  const recentMedicines = medicines.filter((medicine) => medicine.at >= weekStart)
  const vitaminDDosesThisWeek = recentMedicines.filter((medicine) => medicine.kind === 'vitamin_d').length
  const latestVitaminD = medicines
    .filter((medicine) => medicine.kind === 'vitamin_d' && Number.isFinite(medicine.at))
    .sort((a, b) => b.at - a.at)[0] ?? null
  const vitaminDTakenToday = Boolean(latestVitaminD && latestVitaminD.at >= dayStartMs)
  const recentTummyTimes = tummyTimes.filter((event) => event.startedAt >= weekStart)
  const tummyMinutesToday = tummyTimeMinutesToday(tummyTimes, now)
  const tummyTotalMinutes = recentTummyTimes.reduce((sum, event) => sum + Math.round(tummyTimeDurationSeconds(event) / 60), 0)
  const tummyDays = weekWindows.map((window) => {
    const minutes = tummyTimes
      .filter((event) => event.startedAt >= window.startMs && event.startedAt < window.endMs)
      .reduce((sum, event) => sum + Math.round(tummyTimeDurationSeconds(event) / 60), 0)
    return { label: window.label, minutes, goalPercent: Math.min(100, Math.round((minutes / tummyDailyGoalMinutes) * 100)), startMs: window.startMs, endMs: window.endMs }
  })
  const tummyGoalPercentToday = Math.min(100, Math.round((tummyMinutesToday / tummyDailyGoalMinutes) * 100))
  const tummyGoalDays = tummyDays.filter((day) => day.minutes >= tummyDailyGoalMinutes).length
  const tummyAverageMinutesPerDay = roundTenth(tummyTotalMinutes / 7)
  const tummyBestDay = tummyDays.reduce((best, day) => (day.minutes > best.minutes ? day : best), tummyDays[0] ?? { label: 'Not yet', minutes: 0, goalPercent: 0 })

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
    longestGapLabel: longestGap ? formatDuration(Math.round(longestGap / 1000)) : 'Not yet',
    bottleFeeds,
    wetCount,
    stoolCount,
    diaperAverages: calculateDiaperAverages(entries, diapers, dayStartMs, today, wetCount, stoolCount),
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
