import { describe, expect, it } from 'vitest'
import { dueCustomTrackerReminders, reminderSummary } from './customTrackerReminders'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../state/notificationPreferences'
import type { CustomEvent, CustomTracker } from '../types'

const day = new Date(2026, 6, 20); day.setHours(0, 0, 0, 0)
const at = (hour: number, minute = 0) => day.getTime() + hour * 3_600_000 + minute * 60_000

const tracker = (over: Partial<CustomTracker> = {}): CustomTracker => ({
  id: 't1', name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'count', target: 3 },
  reminder: { kind: 'interval', everyHours: 4 }, createdAt: at(0), archivedAt: null, ...over,
})
const event = (over: Partial<CustomEvent> = {}): CustomEvent => ({ id: 'e1', trackerId: 't1', at: at(9), ...over })

const due = (trackers: CustomTracker[], events: CustomEvent[], now: number, preferences = DEFAULT_NOTIFICATION_PREFERENCES) =>
  dueCustomTrackerReminders({ trackers, events, now, preferences })

describe('interval reminders', () => {
  it('asks once the interval has passed since the last log', () => {
    expect(due([tracker()], [event({ at: at(9) })], at(12, 30))).toHaveLength(0)
    const asked = due([tracker()], [event({ at: at(9) })], at(13, 30))
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ trackerId: 't1', name: 'Vitamin C' })
    expect(asked[0].copy).toBe('Vitamin C: 1 of 3 today.')
  })

  it('measures from the last log, so keeping up with it keeps it quiet', () => {
    // Logged an hour ago; the four-hour clock restarted then.
    expect(due([tracker()], [event({ at: at(9) }), event({ id: 'e2', at: at(13) })], at(14))).toHaveLength(0)
  })

  it('falls back to the start of the day when nothing is logged yet', () => {
    expect(due([tracker()], [], at(3))).toHaveLength(0)
    expect(due([tracker()], [], at(5))).toHaveLength(1)
  })

  it('gives a stable id within one lapse, so a per-second re-render cannot stack duplicates', () => {
    const first = due([tracker()], [event({ at: at(9) })], at(13, 30))[0]
    const later = due([tracker()], [event({ at: at(9) })], at(13, 45))[0]
    expect(later.id).toBe(first.id)
    // A second missed interval is a new thing to say.
    expect(due([tracker()], [event({ at: at(9) })], at(17, 30))[0].id).not.toBe(first.id)
  })
})

describe('time-of-day reminders', () => {
  const morning = tracker({ goal: { kind: 'once' }, reminder: { kind: 'timeOfDay', atMinutes: 9 * 60 } })

  it('stays quiet before the hour and asks after it', () => {
    expect(due([morning], [], at(8, 59))).toHaveLength(0)
    expect(due([morning], [], at(9, 1))[0].copy).toBe('Vitamin C has not been logged today.')
  })

  it('says nothing if it was already logged after the hour', () => {
    expect(due([morning], [event({ at: at(9, 30) })], at(11))).toHaveLength(0)
  })

  it('still asks if the only log was before the hour', () => {
    const twice = tracker({ goal: { kind: 'count', target: 2 }, reminder: { kind: 'timeOfDay', atMinutes: 9 * 60 } })
    expect(due([twice], [event({ at: at(7) })], at(11))).toHaveLength(1)
  })
})

describe('what silences a reminder', () => {
  it('says nothing once the day’s goal is met', () => {
    const events = [event({ id: 'a', at: at(6) }), event({ id: 'b', at: at(7) }), event({ id: 'c', at: at(8) })]
    expect(due([tracker()], events, at(20))).toHaveLength(0)
  })

  it('respects quiet hours', () => {
    const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, quietHours: { enabled: true, startHour: 22, startMinute: 0, endHour: 7, endMinute: 0 } }
    expect(due([tracker()], [], at(23), preferences)).toHaveLength(0)
    expect(due([tracker()], [], at(5), preferences)).toHaveLength(0)
    expect(due([tracker()], [], at(9), preferences)).toHaveLength(1)
  })

  it('ignores archived trackers and those with no schedule', () => {
    expect(due([tracker({ archivedAt: at(1) })], [], at(20))).toHaveLength(0)
    expect(due([tracker({ reminder: null })], [], at(20))).toHaveLength(0)
    // A schedule written by a newer build is ignored rather than crashing.
    expect(due([tracker({ reminder: { kind: 'lunar' } as never })], [], at(20))).toHaveLength(0)
  })

  it('measures a duration goal in minutes', () => {
    const physio = tracker({ goal: { kind: 'duration', targetMinutes: 15 }, reminder: { kind: 'interval', everyHours: 4 } })
    expect(due([physio], [event({ at: at(9), durationSeconds: 300 })], at(14))[0].copy).toBe('Vitamin C: 5 of 15 min today.')
  })
})

describe('reminder summaries', () => {
  it('reads back what was chosen', () => {
    expect(reminderSummary(null)).toBe('No reminder')
    expect(reminderSummary({ kind: 'interval', everyHours: 1 })).toBe('Every 1 hour')
    expect(reminderSummary({ kind: 'interval', everyHours: 4 })).toBe('Every 4 hours')
    expect(reminderSummary({ kind: 'timeOfDay', atMinutes: 9 * 60 + 30 })).toMatch(/9:30/)
  })
})
