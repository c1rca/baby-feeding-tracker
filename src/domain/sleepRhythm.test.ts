import { describe, expect, it } from 'vitest'
import { buildDiaperWatch, buildWakeWindow, wakeWindowForAge, ageMonthsFromDob } from './sleepRhythm'
import type { TummyTimeEvent } from '../types'

const now = new Date(2026, 6, 20, 14, 0).getTime()
const minutesAgo = (minutes: number) => now - minutes * 60_000
const dobForMonths = (months: number) => {
  const date = new Date(now - months * 30.44 * 86_400_000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const nap = (id: string, endedMinutesAgo: number, durationMinutes = 45): TummyTimeEvent => ({
  id,
  kind: 'sleep',
  startedAt: minutesAgo(endedMinutesAgo + durationMinutes),
  endedAt: minutesAgo(endedMinutesAgo),
})

describe('wake windows by age', () => {
  it('widens as the baby gets older', () => {
    expect(wakeWindowForAge(0.5).maxMinutes).toBeLessThan(wakeWindowForAge(4).maxMinutes)
    expect(wakeWindowForAge(4).maxMinutes).toBeLessThan(wakeWindowForAge(10).maxMinutes)
  })

  it('falls back to a broad band with no date of birth', () => {
    expect(ageMonthsFromDob('', now)).toBeNull()
    expect(wakeWindowForAge(null)).toEqual({ minMinutes: 60, maxMinutes: 120 })
  })
})

describe('buildWakeWindow', () => {
  const dob = dobForMonths(2)

  it('says nothing more while a sleep timer is running', () => {
    const model = buildWakeWindow([], { id: 's', startedAt: minutesAgo(20), note: '', kind: 'sleep' }, dob, now)
    expect(model.status).toBe('asleep')
    expect(model.copy).toBe('Asleep now.')
  })

  it('asks for a first sleep rather than inventing a window', () => {
    const model = buildWakeWindow([], null, dob, now)
    expect(model.status).toBe('no-data')
    expect(model.copy).toMatch(/Log a sleep/i)
  })

  it('predicts the next nap while the baby is freshly awake', () => {
    const model = buildWakeWindow([nap('recent', 20)], null, dob, now)
    expect(model.status).toBe('settling')
    expect(model.awakeMinutes).toBeCloseTo(20, 0)
    expect(model.copy).toMatch(/next nap around/i)
  })

  it('flags being inside and then past the usual window', () => {
    expect(buildWakeWindow([nap('a', 75)], null, dob, now).status).toBe('approaching')
    expect(buildWakeWindow([nap('b', 200)], null, dob, now).status).toBe('overdue')
  })

  it('ignores tummy time, which is not sleep', () => {
    const tummy: TummyTimeEvent = { id: 't', kind: 'tummy', startedAt: minutesAgo(30), endedAt: minutesAgo(20) }
    expect(buildWakeWindow([tummy], null, dob, now).status).toBe('no-data')
  })
})

describe('buildDiaperWatch', () => {
  it('stays quiet with a recent wet diaper', () => {
    const watch = buildDiaperWatch([{ at: minutesAgo(90) }], now)
    expect(watch.alert).toBe(false)
    expect(watch.copy).toMatch(/Last wet diaper 1h 30m ago/i)
  })

  it('raises a gap once it crosses the threshold and points at a clinician', () => {
    const watch = buildDiaperWatch([{ at: minutesAgo(7 * 60) }], now)
    expect(watch.alert).toBe(true)
    expect(watch.copy).toMatch(/pediatrician/i)
  })

  it('respects a custom threshold', () => {
    expect(buildDiaperWatch([{ at: minutesAgo(5 * 60) }], now, 4).alert).toBe(true)
    expect(buildDiaperWatch([{ at: minutesAgo(5 * 60) }], now, 8).alert).toBe(false)
  })

  it('does not alert when nothing has ever been logged', () => {
    const watch = buildDiaperWatch([], now)
    expect(watch.alert).toBe(false)
    expect(watch.lastWetAt).toBeNull()
  })

  it('uses the most recent signal, not the first', () => {
    const watch = buildDiaperWatch([{ at: minutesAgo(600) }, { at: minutesAgo(30) }], now)
    expect(watch.alert).toBe(false)
  })
})
