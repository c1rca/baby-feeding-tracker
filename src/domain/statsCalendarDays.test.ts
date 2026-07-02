import { describe, expect, it } from 'vitest'
import { calculateStats } from './statsDashboard'
import { calculateTrend } from './statsSummary'
import type { Entry } from '../types'

const entry = (id: string, endedAt: number, leftSeconds = 600): Entry => ({
  id,
  type: 'breast',
  startedAt: endedAt - leftSeconds,
  endedAt,
  leftSeconds,
  rightSeconds: 0,
  bottleOunces: null,
})

describe('calendar-aware stats day windows', () => {
  it('uses the same local-day windows for trend counts and feeding-hour bars across DST-sized days', () => {
    const now = new Date(2026, 10, 2, 12, 0, 0).getTime()
    const trend = calculateTrend([
      entry('sun-early', new Date(2026, 10, 1, 1, 30, 0).getTime(), 300),
      entry('sun-late', new Date(2026, 10, 1, 23, 30, 0).getTime(), 900),
    ], now)
    const stats = calculateStats([
      entry('sun-early', new Date(2026, 10, 1, 1, 30, 0).getTime(), 300),
      entry('sun-late', new Date(2026, 10, 1, 23, 30, 0).getTime(), 900),
    ], [], [], now, { left: 0, right: 0, wet: 0, stool: 0 }, trend.days)

    const sundayIndex = trend.days.findIndex((day) => day.startMs === new Date(2026, 10, 1, 0, 0, 0).getTime())
    expect(sundayIndex).toBeGreaterThanOrEqual(0)
    expect(trend.days[sundayIndex].count).toBe(2)
    expect(stats.feedingHoursByDay[sundayIndex].seconds).toBe(1200)
    expect(stats.feedingHoursByDay[sundayIndex].startMs).toBe(trend.days[sundayIndex].startMs)
    expect(stats.feedingHoursByDay[sundayIndex].endMs).toBe(trend.days[sundayIndex].endMs)
  })
})
