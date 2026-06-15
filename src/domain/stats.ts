import { formatDuration } from './feedingUtils'
import { diaperKinds, entryDiaperKinds, oppositeSide, sideLabel } from './labels'
import { DAY_MS } from './time'
import type { DiaperEvent, DiaperKind, Entry, Side } from '../types'

const roundTenth = (value: number) => Math.round(value * 10) / 10
const startOfDayMs = (timestamp: number) => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export const sortEntriesLatestFirst = (entries: Entry[]) =>
  entries.slice().sort((a, b) => b.startedAt - a.startedAt || b.endedAt - a.endedAt)

export const calculateTodaySummary = (entries: Entry[], diapers: DiaperEvent[], now = new Date().getTime()) => {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const startMs = start.getTime()
  const list = entries.filter((e) => e.endedAt >= startMs)
  return {
    count: list.length,
    nursing: list.reduce((a, e) => a + e.leftSeconds + e.rightSeconds, 0),
    left: list.reduce((a, e) => a + e.leftSeconds, 0),
    right: list.reduce((a, e) => a + e.rightSeconds, 0),
    oz: list.reduce((a, e) => a + (e.bottleOunces ?? 0), 0),
    wet: diapers.filter((d) => d.at >= startMs && diaperKinds(d).includes('wet')).length + list.filter((e) => entryDiaperKinds(e).includes('wet')).length,
    stool: diapers.filter((d) => d.at >= startMs && diaperKinds(d).includes('stool')).length + list.filter((e) => entryDiaperKinds(e).includes('stool')).length,
  }
}

export const calculateTrend = (entries: Entry[], now = new Date().getTime()) => {
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (6 - i))
    const start = d.getTime()
    const end = start + DAY_MS
    const dayEntries = entries.filter((e) => e.endedAt >= start && e.endedAt < end)
    return { label: d.toLocaleDateString([], { weekday: 'short' }), count: dayEntries.length }
  })
  const max = Math.max(1, ...days.map((d) => d.count))
  return { days, max }
}

export const calculateSuggestedSide = (entries: Entry[], today: { left: number; right: number }): Side => {
  const lastNursing = entries.find((entry) => entry.leftSeconds + entry.rightSeconds > 0)
  if (!lastNursing) return today.left <= today.right ? 'left' : 'right'
  if (lastNursing.leftSeconds === lastNursing.rightSeconds) return today.left <= today.right ? 'left' : 'right'
  return oppositeSide(lastNursing.leftSeconds > lastNursing.rightSeconds ? 'left' : 'right')
}

export const calculateAvgGapMinutes = (entries: Entry[]) => {
  const recent = entries.slice(0, 8).filter((entry) => entry.endedAt > 0).sort((a, b) => a.endedAt - b.endedAt)
  if (recent.length < 2) return null
  const gaps = recent.slice(1).map((entry, index) => Math.max(0, entry.endedAt - recent[index].endedAt))
  return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 60000)
}

export const calculateStats = (
  entries: Entry[],
  diapers: DiaperEvent[],
  now: number,
  today: { left: number; right: number; wet: number; stool: number },
  trendDays: { label: string; count: number }[],
) => {
  const nowDate = new Date(now)
  const dayStart = new Date(nowDate); dayStart.setHours(0, 0, 0, 0)
  const weekStart = dayStart.getTime() - 6 * DAY_MS
  const recentEntries = entries.filter((entry) => entry.endedAt >= weekStart)
  const totalNursing = recentEntries.reduce((sum, entry) => sum + entry.leftSeconds + entry.rightSeconds, 0)
  const totalBottle = recentEntries.reduce((sum, entry) => sum + (entry.bottleOunces ?? 0), 0)
  const nursingFeeds = recentEntries.filter((entry) => entry.leftSeconds + entry.rightSeconds > 0)
  const avgNursing = nursingFeeds.length ? Math.round(totalNursing / nursingFeeds.length) : 0
  const totalLeft = recentEntries.reduce((sum, entry) => sum + entry.leftSeconds, 0)
  const totalRight = recentEntries.reduce((sum, entry) => sum + entry.rightSeconds, 0)
  const balanceTotal = Math.max(1, totalLeft + totalRight)
  const leftPercent = Math.round((totalLeft / balanceTotal) * 100)
  const bestDay = trendDays.reduce((best, day) => (day.count > best.count ? day : best), trendDays[0] ?? { label: '—', count: 0 })
  const sorted = recentEntries.slice().sort((a, b) => a.startedAt - b.startedAt)
  const gaps = sorted.slice(1).map((entry, index) => Math.max(0, entry.startedAt - sorted[index].endedAt))
  const avgGap = gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 1000) : 0
  const nightFeeds = recentEntries.filter((entry) => {
    const hour = new Date(entry.endedAt).getHours()
    return hour < 6 || hour >= 22
  }).length
  const last24Start = now - DAY_MS
  const last24Entries = entries.filter((entry) => entry.endedAt >= last24Start)
  const avgFeedsPerDay = recentEntries.length ? Math.round((recentEntries.length / 7) * 10) / 10 : 0
  const longestNursing = nursingFeeds.reduce((max, entry) => Math.max(max, entry.leftSeconds + entry.rightSeconds), 0)
  const longestGap = gaps.length ? Math.max(...gaps) : 0
  const bottleFeeds = recentEntries.filter((entry) => (entry.bottleOunces ?? 0) > 0).length
  const standaloneWet = diapers.filter((diaper) => diaper.at >= weekStart && diaperKinds(diaper).includes('wet')).length
  const standaloneStool = diapers.filter((diaper) => diaper.at >= weekStart && diaperKinds(diaper).includes('stool')).length
  const feedWet = recentEntries.filter((entry) => entryDiaperKinds(entry).includes('wet')).length
  const feedStool = recentEntries.filter((entry) => entryDiaperKinds(entry).includes('stool')).length
  const wetCount = standaloneWet + feedWet
  const stoolCount = standaloneStool + feedStool
  const allDiaperSignals = [
    ...diapers.flatMap((diaper) => diaperKinds(diaper).map((kind) => ({ kind, at: diaper.at }))),
    ...entries.flatMap((entry) => entryDiaperKinds(entry).map((kind) => ({ kind, at: entry.endedAt }))),
  ]
  const allTimeStart = allDiaperSignals.length ? Math.min(...allDiaperSignals.map((signal) => signal.at)) : dayStart.getTime()
  const allTimeDays = Math.max(1, Math.floor((dayStart.getTime() - startOfDayMs(allTimeStart)) / DAY_MS) + 1)
  const countAllTime = (kind: DiaperKind) => allDiaperSignals.filter((signal) => signal.kind === kind).length
  const diaperAverages = {
    wet: { today: today.wet, weekly: roundTenth(wetCount / 7), allTime: roundTenth(countAllTime('wet') / allTimeDays) },
    stool: { today: today.stool, weekly: roundTenth(stoolCount / 7), allTime: roundTenth(countAllTime('stool') / allTimeDays) },
  }
  const sideDelta = Math.abs(totalLeft - totalRight)
  const balanceLabel = sideDelta < 5 * 60 ? 'Beautifully balanced' : totalLeft > totalRight ? 'Left leading' : 'Right leading'
  const nextSideLabel = sideLabel(calculateSuggestedSide(entries, today))
  const longestGapLabel = longestGap ? formatDuration(Math.round(longestGap / 1000)) : '—'
  const momentumLabel = last24Entries.length >= avgFeedsPerDay ? 'Above weekly pace' : last24Entries.length ? 'Below weekly pace' : 'Quiet 24h'
  return { recentEntries, totalNursing, totalBottle, avgNursing, totalLeft, totalRight, leftPercent, bestDay, avgGap, nightFeeds, last24Entries, avgFeedsPerDay, longestNursing, longestGap, longestGapLabel, bottleFeeds, wetCount, stoolCount, diaperAverages, balanceLabel, nextSideLabel, momentumLabel }
}
