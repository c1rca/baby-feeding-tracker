import { describe, expect, it } from 'vitest'
import { calculateDiaperAverages } from './statsDiapers'
import type { DiaperEvent, Entry } from '../types'

/**
 * Wet diapers per day is the front-line infant hydration signal — the number a
 * pediatrician asks for. It shipped dividing a range-wide count by a hard-coded
 * 7, so a 30-day view reported 25.7 wet diapers a day for a baby having six:
 * physiologically impossible, and sitting right beside a correct all-time
 * figure that made it read as a recent surge.
 *
 * The fix landed without tests — this file is the missing half. Every case
 * sweeps the range selector, because a single range can never catch a divisor
 * that is only wrong for the other two.
 */

const DAY = 24 * 60 * 60 * 1000
const dayStart = new Date('2026-07-31T00:00:00').getTime()

const diaper = (id: string, daysAgo: number, kinds: Array<'wet' | 'stool'>): DiaperEvent => ({
  id,
  kinds,
  at: dayStart - daysAgo * DAY + 9 * 60 * 60 * 1000,
  context: 'standalone',
})

const feedWithDiaper = (id: string, daysAgo: number, kinds: Array<'wet' | 'stool'>): Entry => ({
  id,
  type: 'breast',
  startedAt: dayStart - daysAgo * DAY + 10 * 60 * 60 * 1000,
  endedAt: dayStart - daysAgo * DAY + 10.5 * 60 * 60 * 1000,
  leftSeconds: 600,
  rightSeconds: 0,
  bottleOunces: null,
  diaperKinds: kinds,
})

/** `count` wet diapers a day, every day, for `days` days back. */
const steadyWet = (perDay: number, days: number) => {
  const diapers: DiaperEvent[] = []
  for (let day = 0; day < days; day++) {
    for (let n = 0; n < perDay; n++) diapers.push(diaper(`w-${day}-${n}`, day, ['wet']))
  }
  return diapers
}

describe('diaper averages', () => {
  it.each([7, 14, 30])('reports the true per-day rate over a %i-day range', (rangeDays) => {
    // Six a day, sustained across the whole window: the answer is six for every
    // range. A divisor pinned to 7 gives 6 / 12 / 25.7 instead.
    const diapers = steadyWet(6, rangeDays)
    const wetCount = 6 * rangeDays

    const averages = calculateDiaperAverages(
      [], diapers, dayStart, { wet: 6, stool: 0 }, wetCount, 0, rangeDays,
    )

    expect(averages.wet.weekly).toBe(6)
  })

  it.each([7, 14, 30])('divides stool by the selected range too (%i days)', (rangeDays) => {
    const diapers: DiaperEvent[] = []
    for (let day = 0; day < rangeDays; day++) diapers.push(diaper(`s-${day}`, day, ['stool']))

    const averages = calculateDiaperAverages(
      [], diapers, dayStart, { wet: 0, stool: 1 }, 0, rangeDays, rangeDays,
    )

    expect(averages.stool.weekly).toBe(1)
  })

  it('defaults to a 7-day divisor when the range is not supplied', () => {
    const averages = calculateDiaperAverages([], steadyWet(6, 7), dayStart, { wet: 6, stool: 0 }, 42, 0)
    expect(averages.wet.weekly).toBe(6)
  })

  it('passes today through untouched rather than deriving it', () => {
    const averages = calculateDiaperAverages([], steadyWet(6, 7), dayStart, { wet: 4, stool: 2 }, 42, 7, 7)
    expect(averages.wet.today).toBe(4)
    expect(averages.stool.today).toBe(2)
  })

  it('counts diapers attached to a feed alongside standalone ones', () => {
    // A diaper logged against a feed is the same event to a caregiver, so it has
    // to reach the all-time rate as well as the standalone ones.
    const entries = [feedWithDiaper('e-1', 0, ['wet']), feedWithDiaper('e-2', 1, ['wet'])]
    const diapers = [diaper('d-1', 0, ['wet']), diaper('d-2', 1, ['wet'])]

    const averages = calculateDiaperAverages(entries, diapers, dayStart, { wet: 2, stool: 0 }, 4, 0, 7)

    // Four wet signals spanning two calendar days → 2.0 a day all-time.
    expect(averages.wet.allTime).toBe(2)
  })

  it('splits a mixed diaper into both kinds', () => {
    const diapers = [diaper('m-1', 0, ['wet', 'stool']), diaper('m-2', 1, ['wet', 'stool'])]
    const averages = calculateDiaperAverages([], diapers, dayStart, { wet: 1, stool: 1 }, 2, 2, 7)
    expect(averages.wet.allTime).toBe(1)
    expect(averages.stool.allTime).toBe(1)
  })

  it('never divides by zero when nothing has been logged', () => {
    const averages = calculateDiaperAverages([], [], dayStart, { wet: 0, stool: 0 }, 0, 0, 30)
    expect(averages.wet.weekly).toBe(0)
    expect(averages.wet.allTime).toBe(0)
    expect(Number.isFinite(averages.wet.allTime)).toBe(true)
    expect(Number.isFinite(averages.stool.allTime)).toBe(true)
  })

  it('rounds to a tenth rather than showing a full float', () => {
    // 10 over 7 days is 1.428…; a caregiver should see 1.4, not the raw value.
    const averages = calculateDiaperAverages([], steadyWet(1, 7), dayStart, { wet: 1, stool: 0 }, 10, 0, 7)
    expect(averages.wet.weekly).toBe(1.4)
  })
})
