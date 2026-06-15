import { diaperKinds, entryDiaperKinds } from './labels'
import { DAY_MS } from './time'
import type { DiaperEvent, DiaperKind, Entry } from '../types'

export const roundTenth = (value: number) => Math.round(value * 10) / 10

export const startOfDayMs = (timestamp: number) => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export const entriesSince = (entries: Entry[], startMs: number) => entries.filter((entry) => entry.endedAt >= startMs)

export const nursingSeconds = (entry: Entry) => entry.leftSeconds + entry.rightSeconds

export const bottleOunces = (entry: Entry) => entry.bottleOunces ?? 0

export const countDiaperKind = (diapers: DiaperEvent[], entries: Entry[], kind: DiaperKind, startMs: number) =>
  diapers.filter((diaper) => diaper.at >= startMs && diaperKinds(diaper).includes(kind)).length +
  entries.filter((entry) => entry.endedAt >= startMs && entryDiaperKinds(entry).includes(kind)).length

export const collectDiaperSignals = (diapers: DiaperEvent[], entries: Entry[]) => [
  ...diapers.flatMap((diaper) => diaperKinds(diaper).map((kind) => ({ kind, at: diaper.at }))),
  ...entries.flatMap((entry) => entryDiaperKinds(entry).map((kind) => ({ kind, at: entry.endedAt }))),
]

export const allTimeDayCount = (signals: { at: number }[], fallbackStartMs: number) => {
  const allTimeStart = signals.length ? Math.min(...signals.map((signal) => signal.at)) : fallbackStartMs
  return Math.max(1, Math.floor((fallbackStartMs - startOfDayMs(allTimeStart)) / DAY_MS) + 1)
}

export const averageGapSeconds = (entries: Entry[]) => {
  const sorted = entries.slice().sort((a, b) => a.startedAt - b.startedAt)
  const gaps = sorted.slice(1).map((entry, index) => Math.max(0, entry.startedAt - sorted[index].endedAt))
  return gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length / 1000) : 0
}

export const longestGapMs = (entries: Entry[]) => {
  const sorted = entries.slice().sort((a, b) => a.startedAt - b.startedAt)
  const gaps = sorted.slice(1).map((entry, index) => Math.max(0, entry.startedAt - sorted[index].endedAt))
  return gaps.length ? Math.max(...gaps) : 0
}
