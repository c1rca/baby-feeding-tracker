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
})
