import { oppositeSide } from './labels'
import { localDayWindows } from './time'
import type { DiaperEvent, Entry, Side } from '../types'
import { bottleOunces, countDiaperKind, entriesSince, nursingSeconds, startOfDayMs } from './statsUtils'

export const sortEntriesLatestFirst = (entries: Entry[]) =>
  entries.slice().sort((a, b) => b.startedAt - a.startedAt || b.endedAt - a.endedAt)

export const calculateTodaySummary = (entries: Entry[], diapers: DiaperEvent[], now = new Date().getTime()) => {
  const startMs = startOfDayMs(now)
  const list = entriesSince(entries, startMs)
  return {
    count: list.length,
    nursing: list.reduce((sum, entry) => sum + nursingSeconds(entry), 0),
    left: list.reduce((sum, entry) => sum + entry.leftSeconds, 0),
    right: list.reduce((sum, entry) => sum + entry.rightSeconds, 0),
    oz: list.reduce((sum, entry) => sum + bottleOunces(entry), 0),
    wet: countDiaperKind(diapers, entries, 'wet', startMs),
    stool: countDiaperKind(diapers, entries, 'stool', startMs),
  }
}

export const calculateTrend = (entries: Entry[], now = new Date().getTime()) => {
  const days = localDayWindows(now, 7).map(({ startMs, endMs, label }) => {
    const dayEntries = entries.filter((entry) => entry.endedAt >= startMs && entry.endedAt < endMs)
    return { label, count: dayEntries.length, startMs, endMs }
  })
  const max = Math.max(1, ...days.map((day) => day.count))
  return { days, max }
}

export const calculateSuggestedSide = (entries: Entry[], today: { left: number; right: number }): Side => {
  const lastNursing = entries.find((entry) => nursingSeconds(entry) > 0)
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
