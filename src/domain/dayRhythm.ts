import type { CustomEvent, CustomTracker, DiaperEvent, Entry, MedicineEvent, TummyTimeEvent } from '../types'
import { activeCustomTrackers, customTrackerProgress } from './customTrackers'
import { entryDiaperKinds } from './labels'
import { startOfLocalDayMs } from './tummyTime'

const DAY_MS = 24 * 60 * 60 * 1000

export type RhythmFeed = { id: string; atMs: number; endMs: number; type: 'breast' | 'bottle' | 'mixed'; leftSeconds?: number; rightSeconds?: number }
export type RhythmDiaper = { id: string; atMs: number; kind: 'wet' | 'stool' | 'mixed' }
export type RhythmSpan = { id: string; startMs: number; endMs: number; kind: 'sleep' | 'tummy' }

// What the day amounted to, for the recap strip: the things a caregiver checks
// on before the day ends, each already resolved to done/not so the view does
// not have to re-derive them.
export type RhythmCustomRecap = { id: string; name: string; icon: string; hue: string; detail: string; done: boolean }

export type RhythmRecap = {
  tummyMinutes: number
  tummyGoalMinutes: number
  tummyGoalMet: boolean
  sleepMinutes: number
  /**
   * Whether to show rest at all. A household that never logs sleep does not
   * want a permanent "No sleep yet" row; one that usually logs it wants to see
   * the gap on a day it forgot. So: any sleep today, or any sleep on record.
   */
  showSleep: boolean
  vitaminDAtMs: number | null
  wet: number
  stool: number
  // Only trackers with something logged that day. The recap says what happened,
  // not what is outstanding — that is Today's needs' job.
  customs: RhythmCustomRecap[]
}

export type DayRhythm = {
  dayStartMs: number
  dayEndMs: number
  nowMs: number
  feeds: RhythmFeed[]
  diapers: RhythmDiaper[]
  spans: RhythmSpan[]
  summary: string
  recap: RhythmRecap
}

const diaperKindsOf = (diaper: DiaperEvent): ('wet' | 'stool')[] => {
  if (diaper.kinds && diaper.kinds.length > 0) return diaper.kinds
  return diaper.kind ? [diaper.kind] : []
}

// Oldest day that holds anything worth showing, so the date picker can stop
// there instead of letting caregivers wander into empty history.
export function earliestRhythmDayMs(entries: Entry[], diapers: DiaperEvent[], tummyTimes: TummyTimeEvent[]): number | null {
  let earliest: number | null = null
  const consider = (at: number) => { if (Number.isFinite(at) && at > 0 && (earliest === null || at < earliest)) earliest = at }
  entries.forEach((entry) => consider(entry.startedAt))
  diapers.forEach((diaper) => consider(diaper.at))
  tummyTimes.forEach((event) => consider(event.startedAt))
  return earliest === null ? null : startOfLocalDayMs(earliest)
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`
const activeFeedEnd = (entry: Entry) => entry.startedAt + Math.max(0, entry.leftSeconds + entry.rightSeconds) * 1000

// `dayAnchorMs` picks which calendar day to build; it defaults to today so the
// ribbon keeps its old behaviour, and the expanded view passes a past day when
// the caregiver steps back through the date picker.
export function buildDayRhythm(
  entries: Entry[],
  diapers: DiaperEvent[],
  tummyTimes: TummyTimeEvent[],
  now: number,
  dayAnchorMs: number = now,
  extras: { medicines?: MedicineEvent[]; tummyGoalMinutes?: number; customTrackers?: CustomTracker[]; customEvents?: CustomEvent[] } = {},
): DayRhythm {
  const dayStartMs = startOfLocalDayMs(dayAnchorMs)
  const dayEndMs = dayStartMs + DAY_MS
  const inDay = (at: number) => at >= dayStartMs && at < dayEndMs

  const feeds = entries
    .filter((entry) => inDay(entry.startedAt))
    .map((entry) => ({
      id: entry.id,
      atMs: entry.startedAt,
      endMs: Math.min(Math.max(activeFeedEnd(entry), entry.startedAt), dayEndMs),
      type: entry.type,
      leftSeconds: entry.leftSeconds,
      rightSeconds: entry.rightSeconds,
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
      endMs: Math.min(event.endedAt, dayEndMs, now),
      kind: (event.kind === 'sleep' ? 'sleep' : 'tummy') as RhythmSpan['kind'],
    }))
    .sort((a, b) => a.startMs - b.startMs)

  const napCount = spans.filter((span) => span.kind === 'sleep').length
  const tummyCount = spans.filter((span) => span.kind === 'tummy').length
  const parts = [plural(feeds.length, 'feed'), plural(rhythmDiapers.length, 'diaper')]
  if (napCount > 0) parts.push(plural(napCount, 'sleep'))
  if (tummyCount > 0) parts.push(`${plural(tummyCount, 'tummy session')}`)

  const minutesOf = (kind: RhythmSpan['kind']) =>
    Math.round(spans.filter((span) => span.kind === kind).reduce((total, span) => total + Math.max(0, span.endMs - span.startMs), 0) / 60000)
  const tummyMinutes = minutesOf('tummy')
  const tummyGoalMinutes = extras.tummyGoalMinutes ?? 0
  // The most recent dose that day — a caregiver checking "has she had it" wants
  // the latest, and a second dose should not read as an earlier time.
  const vitaminDAtMs = (extras.medicines ?? [])
    .filter((medicine) => medicine.kind === 'vitamin_d' && inDay(medicine.at))
    .reduce<number | null>((latest, medicine) => (latest === null || medicine.at > latest ? medicine.at : latest), null)

  const customEvents = extras.customEvents ?? []
  const customs = activeCustomTrackers(extras.customTrackers ?? [])
    .map((tracker) => {
      const progress = customTrackerProgress(tracker, customEvents, dayStartMs)
      if (progress.count === 0) return null
      const detail = progress.goal.kind === 'once'
        ? 'Done'
        : progress.goal.kind === 'count'
          ? `${progress.count} of ${progress.target}`
          : `${progress.minutes} of ${progress.target} min`
      return { id: tracker.id, name: tracker.name, icon: tracker.icon, hue: tracker.hue, detail, done: progress.done }
    })
    .filter((item): item is RhythmCustomRecap => item !== null)

  return {
    dayStartMs,
    dayEndMs,
    nowMs: Math.min(Math.max(now, dayStartMs), dayEndMs),
    feeds,
    diapers: rhythmDiapers,
    spans,
    summary: parts.join(', '),
    recap: {
      tummyMinutes,
      tummyGoalMinutes,
      tummyGoalMet: tummyGoalMinutes > 0 && tummyMinutes >= tummyGoalMinutes,
      sleepMinutes: minutesOf('sleep'),
      showSleep: minutesOf('sleep') > 0 || tummyTimes.some((event) => event.kind === 'sleep'),
      vitaminDAtMs,
      wet: rhythmDiapers.filter((diaper) => diaper.kind === 'wet' || diaper.kind === 'mixed').length,
      stool: rhythmDiapers.filter((diaper) => diaper.kind === 'stool' || diaper.kind === 'mixed').length,
      customs,
    },
  }
}
