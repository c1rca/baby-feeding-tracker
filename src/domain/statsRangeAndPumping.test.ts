import { describe, expect, it } from 'vitest'
import { calculateStats } from './statsDashboard'
import { calculateTrend } from './statsSummary'
import type { Entry, PumpEvent } from '../types'

const day = new Date(2026, 6, 20)
day.setHours(0, 0, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1000
const now = day.getTime() + 12 * 3_600_000

const feedDaysAgo = (id: string, daysAgo: number): Entry => {
  const endedAt = now - daysAgo * DAY_MS
  return { id, type: 'breast', startedAt: endedAt - 600_000, endedAt, leftSeconds: 600, rightSeconds: 0, bottleOunces: null }
}

const pumpDaysAgo = (id: string, daysAgo: number, leftOunces: number, rightOunces: number): PumpEvent => {
  const startedAt = now - daysAgo * DAY_MS
  return { id, startedAt, endedAt: startedAt + 900_000, leftOunces, rightOunces }
}

const emptyToday = { left: 0, right: 0, wet: 0, stool: 0 }
const statsFor = (entries: Entry[], rangeDays: number, pumpEvents: PumpEvent[] = []) =>
  calculateStats(entries, [], [], now, emptyToday, calculateTrend(entries, now, rangeDays).days, [], undefined, { pumpEvents, rangeDays })

describe('stats date range', () => {
  // One feed a day for 20 days: a wider window must reach further back and
  // average over the window it actually covers, not a hard-coded week.
  const entries = Array.from({ length: 20 }, (_, index) => feedDaysAgo(`feed-${index}`, index))

  it('defaults to a seven-day window', () => {
    const stats = statsFor(entries, 7)
    expect(stats.rangeDays).toBe(7)
    expect(stats.rangeLabel).toBe('7 days')
    expect(stats.recentEntries).toHaveLength(7)
    expect(stats.avgFeedsPerDay).toBe(1)
  })

  it('reaches further back and keeps per-day averages correct at 30 days', () => {
    const stats = statsFor(entries, 30)
    expect(stats.rangeDays).toBe(30)
    expect(stats.recentEntries).toHaveLength(20)
    expect(stats.feedingHoursByDay).toHaveLength(30)
    // 20 feeds spread over a 30-day window.
    expect(stats.avgFeedsPerDay).toBe(0.7)
  })

  it('widens the trend to match the requested range', () => {
    expect(calculateTrend(entries, now, 14).days).toHaveLength(14)
  })
})

describe('pumping stats', () => {
  const pumpEvents = [
    pumpDaysAgo('today', 0, 2, 2.5),
    pumpDaysAgo('yesterday', 1, 3, 3),
    pumpDaysAgo('older', 3, 1, 1),
    pumpDaysAgo('outside-range', 9, 5, 5),
  ]

  it('totals output over the range and excludes sessions outside it', () => {
    const stats = statsFor([], 7, pumpEvents)
    expect(stats.pumpSessions).toBe(3)
    expect(stats.pumpTotalOunces).toBe(12.5)
    expect(stats.pumpAverageOuncesPerSession).toBe(4.2)
    expect(stats.pumpAverageOuncesPerDay).toBe(1.8)
  })

  it('reports today, the best day, and the side split', () => {
    const stats = statsFor([], 7, pumpEvents)
    expect(stats.pumpTodayOunces).toBe(4.5)
    expect(stats.pumpBestDay.ounces).toBe(6)
    expect(stats.pumpLeftOunces).toBe(6)
    expect(stats.pumpRightOunces).toBe(6.5)
  })

  it('treats a blank side as zero rather than dropping the session', () => {
    const stats = statsFor([], 7, [pumpDaysAgo('left-only', 0, 4, 0), { id: 'null-side', startedAt: now, endedAt: now, leftOunces: 3, rightOunces: null }])
    expect(stats.pumpSessions).toBe(2)
    expect(stats.pumpTotalOunces).toBe(7)
  })

  it('stays at zero with no pumping logged', () => {
    const stats = statsFor([], 7)
    expect(stats.pumpSessions).toBe(0)
    expect(stats.pumpTotalOunces).toBe(0)
    expect(stats.pumpBestDay.ounces).toBe(0)
  })
})
