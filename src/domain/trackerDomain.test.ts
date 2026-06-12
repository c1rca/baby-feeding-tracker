import { describe, expect, it, vi } from 'vitest'
import type { DiaperEvent, Entry, Session } from '../types'
import {
  calculateActiveSplit,
  calculateStats,
  calculateSuggestedSide,
  calculateTodaySummary,
  calculateTrend,
  diaperKinds,
  entryToResumedSession,
  normalizeSession,
  parseClockTimeToday,
} from './trackerDomain'

const noon = new Date('2026-01-15T12:00:00').getTime()
const todayAt = (hour: number, minute = 0) => {
  const date = new Date(noon)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: overrides.id ?? `entry-${Math.random()}`,
  type: overrides.type ?? 'breast',
  startedAt: overrides.startedAt ?? todayAt(8),
  endedAt: overrides.endedAt ?? todayAt(8, 20),
  leftSeconds: overrides.leftSeconds ?? 600,
  rightSeconds: overrides.rightSeconds ?? 300,
  bottleOunces: overrides.bottleOunces ?? null,
  note: overrides.note ?? '',
  diaperKinds: overrides.diaperKinds,
})

describe('trackerDomain', () => {
  it('normalizes legacy session optional fields safely', () => {
    expect(normalizeSession({ startedAt: 1, activeSide: 'left', segmentStart: 1, segments: [], diaperKinds: ['wet', 'bogus' as never] })).toEqual({
      startedAt: 1,
      activeSide: 'left',
      segmentStart: 1,
      segments: [],
      bottleOunces: 0,
      note: '',
      diaperKinds: ['wet'],
    })
  })

  it('parses clock inputs against today and rolls future times back to yesterday', () => {
    expect(parseClockTimeToday('8:15am', todayAt(12))).toBe(todayAt(8, 15))
    expect(parseClockTimeToday('11:00pm', todayAt(12))).toBe(todayAt(23) - 24 * 60 * 60 * 1000)
    expect(parseClockTimeToday('25:99', todayAt(12))).toBeNull()
  })

  it('converts a saved entry into a resumable session on the correct side', () => {
    const resumed = entryToResumedSession(entry({ leftSeconds: 120, rightSeconds: 360, bottleOunces: 1.5, note: 'topoff', diaperKinds: ['stool'] }), noon)
    expect(resumed).toMatchObject({ activeSide: 'right', segmentStart: noon, bottleOunces: 1.5, note: 'topoff', diaperKinds: ['stool'] })
    expect(resumed.segments).toEqual([
      { side: 'left', startedAt: todayAt(8), endedAt: todayAt(8) + 120000 },
      { side: 'right', startedAt: todayAt(8) + 120000, endedAt: todayAt(8) + 480000 },
    ])
  })

  it('calculates active split including the live segment', () => {
    const session: Session = { startedAt: todayAt(8), activeSide: 'right', segmentStart: todayAt(8, 10), segments: [{ side: 'left', startedAt: todayAt(8), endedAt: todayAt(8, 5) }], bottleOunces: 0, note: '', diaperKinds: [] }
    expect(calculateActiveSplit(session, todayAt(8, 15))).toEqual({ left: 300, right: 300 })
  })

  it('summarizes today including standalone and feed-attached diapers', () => {
    const entries = [entry({ leftSeconds: 300, rightSeconds: 0, bottleOunces: 2, diaperKinds: ['wet'] }), entry({ endedAt: todayAt(7), leftSeconds: 0, rightSeconds: 0, bottleOunces: 1 })]
    const diapers: DiaperEvent[] = [{ id: 'd1', kinds: ['wet', 'stool'], at: todayAt(9), context: 'standalone' }]
    expect(calculateTodaySummary(entries, diapers, noon)).toMatchObject({ count: 2, nursing: 300, left: 300, right: 0, oz: 3, wet: 2, stool: 1 })
  })

  it('suggests the opposite side from the most recent uneven nursing feed', () => {
    expect(calculateSuggestedSide([entry({ leftSeconds: 700, rightSeconds: 120 })], { left: 700, right: 120 })).toBe('right')
    expect(calculateSuggestedSide([], { left: 60, right: 120 })).toBe('left')
  })

  it('builds weekly trend and stats without UI rendering', () => {
    vi.useFakeTimers()
    vi.setSystemTime(noon)
    const entries = [entry({ id: 'a', endedAt: todayAt(10), leftSeconds: 300, rightSeconds: 300, bottleOunces: 2 }), entry({ id: 'b', endedAt: todayAt(2), leftSeconds: 900, rightSeconds: 0, bottleOunces: null })]
    const diapers: DiaperEvent[] = [{ id: 'd1', kind: 'wet', at: todayAt(3), context: 'standalone' }]
    const trend = calculateTrend(entries, noon)
    const today = calculateTodaySummary(entries, diapers, noon)
    const stats = calculateStats(entries, diapers, noon, today, trend.days)
    expect(trend.days.at(-1)).toMatchObject({ count: 2 })
    expect(stats).toMatchObject({ totalNursing: 1500, totalBottle: 2, bottleFeeds: 1, wetCount: 1, nextSideLabel: 'Right' })
    vi.useRealTimers()
  })

  it('calculates longest stretch as previous end to next start in timeline order', () => {
    const entries = [
      entry({ id: 'overnight', startedAt: todayAt(2, 53), endedAt: todayAt(3, 35), leftSeconds: 0, rightSeconds: 1800 }),
      entry({ id: 'backfill-overlap', startedAt: todayAt(5, 30), endedAt: todayAt(10, 14), leftSeconds: 1800, rightSeconds: 0 }),
      entry({ id: 'morning', startedAt: todayAt(8), endedAt: todayAt(10, 13), leftSeconds: 0, rightSeconds: 1620 }),
    ]
    const trend = calculateTrend(entries, noon)
    const today = calculateTodaySummary(entries, [], noon)

    const stats = calculateStats(entries, [], noon, today, trend.days)

    expect(stats.longestGapLabel).toBe('1h 55m')
  })

  it('normalizes legacy single-kind diapers', () => {
    expect(diaperKinds({ id: 'd1', kind: 'wet', at: noon, context: 'standalone' })).toEqual(['wet'])
  })
})
