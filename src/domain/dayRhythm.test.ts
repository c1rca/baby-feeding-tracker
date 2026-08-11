import { describe, expect, it } from 'vitest'
import { buildDayRhythm } from './dayRhythm'
import { tummyTimeMinutesToday } from './tummyTime'
import type { DiaperEvent, Entry, TummyTimeEvent } from '../types'

const day = new Date(2026, 5, 5)
day.setHours(0, 0, 0, 0)
const at = (h: number, m = 0) => day.getTime() + h * 3_600_000 + m * 60_000
const now = at(14)

const feed = (id: string, h: number, type: Entry['type'] = 'breast'): Entry => ({
  id, type, startedAt: at(h), endedAt: at(h, 20), leftSeconds: 600, rightSeconds: 600, bottleOunces: type === 'bottle' ? 3 : null,
})

describe('buildDayRhythm', () => {
  it('collects only today, classifies markers, and summarizes accessibly', () => {
    const entries: Entry[] = [{ ...feed('f-today', 8), diaperKinds: ['wet'] }, feed('f-bottle', 11, 'bottle'), feed('f-yesterday', -5)]
    const diapers: DiaperEvent[] = [
      { id: 'd-wet', kinds: ['wet'], at: at(9), context: 'standalone' },
      { id: 'd-both', kinds: ['wet', 'stool'], at: at(12), context: 'standalone' },
      { id: 'd-old', kinds: ['wet'], at: at(-3), context: 'standalone' },
    ]
    const tummyTimes: TummyTimeEvent[] = [
      { id: 't-tummy', startedAt: at(10), endedAt: at(10, 8), kind: 'tummy' },
      { id: 't-sleep', startedAt: at(13), endedAt: at(13, 45), kind: 'sleep' },
    ]

    const rhythm = buildDayRhythm(entries, diapers, tummyTimes, now)

    expect(rhythm.feeds.map((f) => f.id)).toEqual(['f-today', 'f-bottle'])
    expect(rhythm.feeds[0]).toMatchObject({ leftSeconds: 600, rightSeconds: 600 })
    expect(rhythm.diapers.map((d) => d.kind)).toEqual(['wet', 'wet', 'mixed'])
    expect(rhythm.diapers.map((d) => d.id)).toContain('feed-diaper:f-today')
    expect(rhythm.spans.map((s) => s.kind)).toEqual(['tummy', 'sleep'])
    expect(rhythm.summary).toBe('2 feeds, 3 diapers, 1 sleep, 1 tummy session')
    expect(rhythm.nowMs).toBe(now)
  })

  it('uses active nursing duration instead of a paused wall-clock gap for feed spans', () => {
    const pausedFeed: Entry = { ...feed('paused-feed', 15), endedAt: at(17, 42), leftSeconds: 18 * 60, rightSeconds: 0 }
    const rhythm = buildDayRhythm([pausedFeed], [], [], now)
    expect(rhythm.feeds[0]).toMatchObject({ atMs: at(15), endMs: at(15, 18) })
  })

  it('does not draw a sleep span past the current time', () => {
    const rhythm = buildDayRhythm([], [], [{ id: 'future-sleep', startedAt: at(13), endedAt: at(20), kind: 'sleep' }], now)
    expect(rhythm.spans[0].endMs).toBe(now)
  })

  it('clamps spans that cross midnight to the visible day', () => {
    const tummyTimes: TummyTimeEvent[] = [{ id: 'overnight', startedAt: at(-1), endedAt: at(1), kind: 'sleep' }]
    const rhythm = buildDayRhythm([], [], tummyTimes, now)
    expect(rhythm.spans).toHaveLength(1)
    expect(rhythm.spans[0].startMs).toBe(rhythm.dayStartMs)
    expect(rhythm.spans[0].endMs).toBe(at(1))
  })
})

describe('tummy time vs sleep separation', () => {
  it('never counts naps toward the tummy time goal', () => {
    const tummyTimes: TummyTimeEvent[] = [
      { id: 'tummy', startedAt: at(10), endedAt: at(10, 8), kind: 'tummy' },
      { id: 'nap', startedAt: at(12), endedAt: at(13, 30), kind: 'sleep' },
    ]
    expect(tummyTimeMinutesToday(tummyTimes, now)).toBe(8)
  })

  it('rounds after summing short tummy-time sessions', () => {
    const shortSessions = Array.from({ length: 10 }, (_, index) => ({
      id: `short-${index}`, kind: 'tummy' as const, startedAt: at(9, index), endedAt: at(9, index) + 40_000,
    }))

    expect(tummyTimeMinutesToday(shortSessions, now)).toBe(7)
  })
})

describe('buildDayRhythm day recap', () => {
  const tummy = (id: string, startH: number, minutes: number, kind: 'tummy' | 'sleep' = 'tummy'): TummyTimeEvent =>
    ({ id, startedAt: at(startH), endedAt: at(startH) + minutes * 60_000, note: '', kind }) as TummyTimeEvent

  it('totals the day\'s tummy time and reports it against the goal', () => {
    const recap = buildDayRhythm([], [], [tummy('t1', 9, 8), tummy('t2', 11, 7), tummy('t3', -6, 30)], now, now, { tummyGoalMinutes: 20 }).recap
    // Only today's sessions count; yesterday's 30m must not carry the goal.
    expect(recap.tummyMinutes).toBe(15)
    expect(recap.tummyGoalMet).toBe(false)
    expect(recap.tummyGoalMinutes).toBe(20)
  })

  it('marks the tummy goal met once the day reaches it', () => {
    const recap = buildDayRhythm([], [], [tummy('t1', 9, 25)], now, now, { tummyGoalMinutes: 20 }).recap
    expect(recap.tummyGoalMet).toBe(true)
  })

  it('never claims a goal is met when none is set', () => {
    const recap = buildDayRhythm([], [], [tummy('t1', 9, 25)], now, now, {}).recap
    expect(recap.tummyGoalMinutes).toBe(0)
    expect(recap.tummyGoalMet).toBe(false)
  })

  it('counts sleep separately from tummy time', () => {
    const recap = buildDayRhythm([], [], [tummy('t1', 9, 12), tummy('s1', 13, 45, 'sleep')], now, now, { tummyGoalMinutes: 20 }).recap
    expect(recap.tummyMinutes).toBe(12)
    expect(recap.sleepMinutes).toBe(45)
  })

  it('reports the latest vitamin D dose of that day, ignoring other days and other medicines', () => {
    const medicines = [
      { id: 'm-early', kind: 'vitamin_d' as const, at: at(8) },
      { id: 'm-late', kind: 'vitamin_d' as const, at: at(17) },
      { id: 'm-yesterday', kind: 'vitamin_d' as const, at: at(-4) },
      { id: 'm-other', kind: 'tylenol' as const, at: at(19) },
    ]
    const recap = buildDayRhythm([], [], [], now, now, { medicines }).recap
    // The latest dose: a caregiver asking "has she had it" should not be shown
    // an earlier time when a second dose was given.
    expect(recap.vitaminDAtMs).toBe(at(17))
  })

  it('leaves vitamin D unset when none was given that day', () => {
    const recap = buildDayRhythm([], [], [], now, now, { medicines: [{ id: 'm', kind: 'vitamin_d' as const, at: at(-4) }] }).recap
    expect(recap.vitaminDAtMs).toBeNull()
  })

  it('counts a mixed change toward both wet and stool', () => {
    const diapers: DiaperEvent[] = [
      { id: 'd-wet', kinds: ['wet'], at: at(9), context: 'standalone' },
      { id: 'd-both', kinds: ['wet', 'stool'], at: at(12), context: 'standalone' },
      { id: 'd-stool', kinds: ['stool'], at: at(13), context: 'standalone' },
    ]
    const recap = buildDayRhythm([], diapers, [], now, now, {}).recap
    expect(recap.wet).toBe(2)
    expect(recap.stool).toBe(2)
  })
})

describe('whether the recap shows rest at all', () => {
  const at = (h: number) => { const d = new Date(2026, 6, 20); d.setHours(h, 0, 0, 0); return d.getTime() }

  it('hides rest for a household that has never logged sleep', () => {
    const rhythm = buildDayRhythm([], [], [{ id: 't1', startedAt: at(9), endedAt: at(9) + 600_000, kind: 'tummy' }], at(14))
    expect(rhythm.recap.showSleep).toBe(false)
  })

  it('shows rest once any sleep exists, even on a day with none', () => {
    // Sleep logged a week earlier: it is part of this household's routine, so a
    // day without it is a gap worth seeing rather than an irrelevant row.
    const lastWeek = at(9) - 7 * 86_400_000
    const rhythm = buildDayRhythm([], [], [{ id: 's1', startedAt: lastWeek, endedAt: lastWeek + 3_600_000, kind: 'sleep' }], at(14))
    expect(rhythm.recap.sleepMinutes).toBe(0)
    expect(rhythm.recap.showSleep).toBe(true)
  })

  it('shows rest when the day itself has sleep', () => {
    const rhythm = buildDayRhythm([], [], [{ id: 's1', startedAt: at(13), endedAt: at(14), kind: 'sleep' }], at(15))
    expect(rhythm.recap.sleepMinutes).toBe(60)
    expect(rhythm.recap.showSleep).toBe(true)
  })
})
