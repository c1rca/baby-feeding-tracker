import { describe, expect, it } from 'vitest'
import {
  activeCustomTrackers, canAddCustomTracker, customTrackerHueToken, customTrackerProgress,
  isCustomTrackerGoal, normalizeCustomEvents, normalizeCustomTrackers,
} from './customTrackers'
import type { CustomEvent, CustomTracker } from '../types'

const day = new Date(2026, 6, 20); day.setHours(0, 0, 0, 0)
const at = (h: number, m = 0) => day.getTime() + h * 3_600_000 + m * 60_000

const tracker = (over: Partial<CustomTracker> = {}): CustomTracker => ({
  id: 't1', name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'count', target: 3 }, createdAt: at(0), ...over,
})
const event = (over: Partial<CustomEvent> = {}): CustomEvent => ({ id: 'e1', trackerId: 't1', at: at(9), ...over })

describe('custom tracker definitions', () => {
  it('drops malformed definitions rather than rendering a broken row', () => {
    const kept = normalizeCustomTrackers([
      tracker(),
      { id: '', name: 'no id', goal: { kind: 'once' }, createdAt: 1 } as CustomTracker,
      { id: 't2', name: '', goal: { kind: 'once' }, createdAt: 1 } as CustomTracker,
      { id: 't3', name: 'no goal', createdAt: 1 } as unknown as CustomTracker,
      { id: 't4', name: 'bad target', goal: { kind: 'count', target: 0 }, createdAt: 1 } as CustomTracker,
    ])
    expect(kept.map((item) => item.id)).toEqual(['t1'])
  })

  it('de-duplicates by id and orders oldest first', () => {
    const kept = normalizeCustomTrackers([
      tracker({ id: 'b', createdAt: at(5) }), tracker({ id: 'a', createdAt: at(1) }), tracker({ id: 'b', createdAt: at(5) }),
    ])
    expect(kept.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('accepts every goal shape and rejects the rest', () => {
    expect(isCustomTrackerGoal({ kind: 'once' })).toBe(true)
    expect(isCustomTrackerGoal({ kind: 'count', target: 3 })).toBe(true)
    expect(isCustomTrackerGoal({ kind: 'duration', targetMinutes: 15 })).toBe(true)
    expect(isCustomTrackerGoal({ kind: 'count', target: 0 })).toBe(false)
    expect(isCustomTrackerGoal({ kind: 'count', target: 1.5 })).toBe(false)
    expect(isCustomTrackerGoal({ kind: 'nonsense' })).toBe(false)
    expect(isCustomTrackerGoal(null)).toBe(false)
  })

  it('falls back to a known hue rather than emitting an undefined token', () => {
    expect(customTrackerHueToken('vitamin')).toBe('var(--hue-vitamin)')
    // A definition written by a newer build must not blank out the row here.
    expect(customTrackerHueToken('chartreuse')).toBe('var(--hue-tummy)')
  })

  it('counts only unarchived trackers toward the limit', () => {
    const trackers = [tracker({ id: 'a' }), tracker({ id: 'b', archivedAt: at(2) })]
    expect(activeCustomTrackers(trackers).map((item) => item.id)).toEqual(['a'])
    expect(canAddCustomTracker(Array.from({ length: 12 }, (_, i) => tracker({ id: `t${i}` })))).toBe(false)
    expect(canAddCustomTracker(Array.from({ length: 12 }, (_, i) => tracker({ id: `t${i}`, archivedAt: at(2) })))).toBe(true)
  })
})

describe('custom tracker progress', () => {
  it('counts a once-a-day tracker as done after one log', () => {
    const t = tracker({ goal: { kind: 'once' } })
    expect(customTrackerProgress(t, [], at(9)).done).toBe(false)
    expect(customTrackerProgress(t, [event()], at(9)).done).toBe(true)
  })

  it('counts logs for a count goal, ignoring other days and other trackers', () => {
    const t = tracker({ goal: { kind: 'count', target: 3 } })
    const events = [
      event({ id: 'a', at: at(8) }), event({ id: 'b', at: at(12) }),
      event({ id: 'c', at: at(-6) }),                       // yesterday
      event({ id: 'd', at: at(13), trackerId: 'other' }),    // another tracker
    ]
    const progress = customTrackerProgress(t, events, at(9))
    expect(progress.count).toBe(2)
    expect(progress.done).toBe(false)
    expect(customTrackerProgress(t, [...events, event({ id: 'e', at: at(15) })], at(9)).done).toBe(true)
  })

  it('totals minutes for a duration goal', () => {
    const t = tracker({ goal: { kind: 'duration', targetMinutes: 15 } })
    const events = [event({ id: 'a', durationSeconds: 600 }), event({ id: 'b', at: at(11), durationSeconds: 300 })]
    const progress = customTrackerProgress(t, events, at(9))
    expect(progress.minutes).toBe(15)
    expect(progress.done).toBe(true)
  })

  // Tightening a goal today must not make yesterday retroactively unmet.
  it('measures a past day against the goal that applied when it was logged', () => {
    const tightened = tracker({ goal: { kind: 'count', target: 5 } })
    const logged = [event({ id: 'a', at: at(8), goalAtLog: { kind: 'count', target: 1 } })]
    const progress = customTrackerProgress(tightened, logged, at(9))
    expect(progress.target).toBe(1)
    expect(progress.done).toBe(true)
  })
})

describe('custom events', () => {
  it('drops events with no tracker and orders newest first', () => {
    const kept = normalizeCustomEvents([
      event({ id: 'old', at: at(1) }),
      event({ id: 'new', at: at(20) }),
      { id: 'orphan', at: at(3) } as unknown as CustomEvent,
    ])
    expect(kept.map((item) => item.id)).toEqual(['new', 'old'])
  })
})
