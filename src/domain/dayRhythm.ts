import type { DiaperEvent, Entry, TummyTimeEvent } from '../types'
import { entryDiaperKinds } from './labels'
import { startOfLocalDayMs } from './tummyTime'

const DAY_MS = 24 * 60 * 60 * 1000

export type RhythmFeed = { id: string; atMs: number; endMs: number; type: 'breast' | 'bottle' | 'mixed' }
export type RhythmDiaper = { id: string; atMs: number; kind: 'wet' | 'stool' | 'mixed' }
export type RhythmSpan = { id: string; startMs: number; endMs: number; kind: 'sleep' | 'tummy' }

export type DayRhythm = {
  dayStartMs: number
  dayEndMs: number
  nowMs: number
  feeds: RhythmFeed[]
  diapers: RhythmDiaper[]
  spans: RhythmSpan[]
  summary: string
}

const diaperKindsOf = (diaper: DiaperEvent): ('wet' | 'stool')[] => {
  if (diaper.kinds && diaper.kinds.length > 0) return diaper.kinds
  return diaper.kind ? [diaper.kind] : []
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

export function buildDayRhythm(entries: Entry[], diapers: DiaperEvent[], tummyTimes: TummyTimeEvent[], now: number): DayRhythm {
  const dayStartMs = startOfLocalDayMs(now)
  const dayEndMs = dayStartMs + DAY_MS
  const inDay = (at: number) => at >= dayStartMs && at < dayEndMs

  const feeds = entries
    .filter((entry) => inDay(entry.startedAt))
    .map((entry) => ({
      id: entry.id,
      atMs: entry.startedAt,
      endMs: Math.min(Math.max(entry.endedAt, entry.startedAt), dayEndMs),
      type: entry.type,
    }))
    .sort((a, b) => a.atMs - b.atMs)

  const rhythmDiapers = [
    ...diapers
      .filter((diaper) => inDay(diaper.at))
      .map((diaper) => {
        const kinds = diaperKindsOf(diaper)
        const kind: RhythmDiaper['kind'] = kinds.length > 1 ? 'mixed' : (kinds[0] ?? 'wet')
        return { id: diaper.id, atMs: diaper.at, kind }
      }),
    ...entries
      .filter((entry) => inDay(entry.endedAt) && entryDiaperKinds(entry).length > 0)
      .map((entry) => {
        const kinds = entryDiaperKinds(entry)
        const kind: RhythmDiaper['kind'] = kinds.length > 1 ? 'mixed' : kinds[0]
        return { id: `feed-diaper:${entry.id}`, atMs: entry.endedAt, kind }
      }),
  ]
    .sort((a, b) => a.atMs - b.atMs)

  const spans = tummyTimes
    .filter((event) => event.endedAt > dayStartMs && event.startedAt < dayEndMs)
    .map((event) => ({
      id: event.id,
      startMs: Math.max(event.startedAt, dayStartMs),
      endMs: Math.min(event.endedAt, dayEndMs),
      kind: (event.kind === 'sleep' ? 'sleep' : 'tummy') as RhythmSpan['kind'],
    }))
    .sort((a, b) => a.startMs - b.startMs)

  const napCount = spans.filter((span) => span.kind === 'sleep').length
  const tummyCount = spans.filter((span) => span.kind === 'tummy').length
  const parts = [plural(feeds.length, 'feed'), plural(rhythmDiapers.length, 'diaper')]
  if (napCount > 0) parts.push(plural(napCount, 'sleep'))
  if (tummyCount > 0) parts.push(`${plural(tummyCount, 'tummy session')}`)

  return {
    dayStartMs,
    dayEndMs,
    nowMs: Math.min(Math.max(now, dayStartMs), dayEndMs),
    feeds,
    diapers: rhythmDiapers,
    spans,
    summary: parts.join(', '),
  }
}
