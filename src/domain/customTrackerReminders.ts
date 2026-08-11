import { activeCustomTrackers, customTrackerProgress } from './customTrackers'
import { isQuietHour } from './notificationWindows'
import type { CustomEvent, CustomTracker, CustomTrackerReminder } from '../types'
import type { NotificationPreferences } from '../state/notificationPreferences'

export type CustomTrackerReminderDue = { id: string; trackerId: string; name: string; copy: string }

const DAY_MS = 24 * 60 * 60 * 1000
const startOfDay = (at: number) => { const date = new Date(at); date.setHours(0, 0, 0, 0); return date.getTime() }

export const isCustomTrackerReminder = (reminder: unknown): reminder is CustomTrackerReminder => {
  if (!reminder || typeof reminder !== 'object') return false
  const candidate = reminder as { kind?: unknown; everyHours?: unknown; atMinutes?: unknown }
  if (candidate.kind === 'interval') return typeof candidate.everyHours === 'number' && candidate.everyHours > 0 && candidate.everyHours <= 24
  if (candidate.kind === 'timeOfDay') return typeof candidate.atMinutes === 'number' && candidate.atMinutes >= 0 && candidate.atMinutes < 24 * 60
  return false
}

export const reminderSummary = (reminder: CustomTrackerReminder | null | undefined) => {
  if (!reminder) return 'No reminder'
  if (reminder.kind === 'interval') return `Every ${reminder.everyHours} ${reminder.everyHours === 1 ? 'hour' : 'hours'}`
  const hours = Math.floor(reminder.atMinutes / 60)
  const minutes = reminder.atMinutes % 60
  return `At ${new Date(2020, 0, 1, hours, minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

/**
 * Which caregiver-defined trackers are asking to be nudged right now.
 *
 * A tracker that has already met its goal for the day never asks — the point is
 * to catch the thing that was forgotten, not to announce a finished job. An
 * interval measures from the last log rather than the clock, so keeping up with
 * a tracker is what silences it.
 *
 * Quiet hours are the same gate every other reminder in the app respects; there
 * is deliberately no second window to configure.
 */
export function dueCustomTrackerReminders({ trackers, events, now, preferences }: {
  trackers: CustomTracker[]
  events: CustomEvent[]
  now: number
  preferences?: NotificationPreferences
}): CustomTrackerReminderDue[] {
  if (preferences && isQuietHour(now, preferences.quietHours)) return []
  const dayStart = startOfDay(now)

  return activeCustomTrackers(trackers).flatMap((tracker) => {
    const reminder = tracker.reminder
    if (!isCustomTrackerReminder(reminder)) return []

    const progress = customTrackerProgress(tracker, events, now)
    if (progress.done) return []

    const todayEvents = events.filter((event) => event.trackerId === tracker.id && event.at >= dayStart && event.at < dayStart + DAY_MS)
    const lastLoggedAt = todayEvents.reduce((latest, event) => Math.max(latest, event.at), 0)

    if (reminder.kind === 'interval') {
      const since = lastLoggedAt || dayStart
      if (now - since < reminder.everyHours * 60 * 60 * 1000) return []
      // The tag changes only when the answer changes, so a per-second re-render
      // cannot stack duplicate notifications for the same lapse.
      const bucket = Math.floor((now - since) / (reminder.everyHours * 60 * 60 * 1000))
      return [{
        id: `custom-${tracker.id}-interval-${since}-${bucket}`,
        trackerId: tracker.id,
        name: tracker.name,
        copy: describe(tracker, progress),
      }]
    }

    if (now < dayStart + reminder.atMinutes * 60_000) return []
    if (lastLoggedAt >= dayStart + reminder.atMinutes * 60_000) return []
    return [{
      id: `custom-${tracker.id}-at-${dayStart}`,
      trackerId: tracker.id,
      name: tracker.name,
      copy: describe(tracker, progress),
    }]
  })
}

const describe = (tracker: CustomTracker, progress: ReturnType<typeof customTrackerProgress>) => {
  if (progress.goal.kind === 'once') return `${tracker.name} has not been logged today.`
  if (progress.goal.kind === 'count') return `${tracker.name}: ${progress.count} of ${progress.target} today.`
  return `${tracker.name}: ${progress.minutes} of ${progress.target} min today.`
}
