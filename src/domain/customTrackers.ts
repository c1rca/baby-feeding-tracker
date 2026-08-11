import { CUSTOM_TRACKER_LIMIT, type CustomEvent, type CustomTracker, type CustomTrackerGoal } from '../types'

/**
 * Curated hues and icons for caregiver-defined trackers.
 *
 * Both are keys, never free values. A hex colour chosen in the light theme
 * regularly turns unreadable in the dark one, and there is no way to polish
 * that away afterwards; every hue below is an existing token already tuned for
 * both. An unknown key falls back rather than rendering nothing, so a
 * definition written by a newer build cannot blank out a row on an older one.
 */
export const CUSTOM_TRACKER_HUES = [
  'tummy', 'vitamin', 'pumping', 'sleep', 'diaper', 'breast', 'bottle', 'wet', 'stool', 'tylenol', 'motrin', 'mixed',
] as const

export const DEFAULT_CUSTOM_HUE = 'tummy'

export const customTrackerHueToken = (hue: string) =>
  `var(--hue-${(CUSTOM_TRACKER_HUES as readonly string[]).includes(hue) ? hue : DEFAULT_CUSTOM_HUE})`

// Keys into a lucide icon map held by the view layer. Kept here so the domain
// can validate a definition without importing React.
export const CUSTOM_TRACKER_ICONS = [
  'sparkles', 'droplet', 'pill', 'sun', 'moon', 'dumbbell', 'thermometer', 'stethoscope',
  'bath', 'shirt', 'book', 'heart', 'smile', 'footprints', 'brush', 'wind',
  'apple', 'cup', 'clock', 'music', 'leaf', 'star', 'shield', 'activity',
] as const

export const DEFAULT_CUSTOM_ICON = 'sparkles'

export const isCustomTrackerIcon = (icon: string) => (CUSTOM_TRACKER_ICONS as readonly string[]).includes(icon)

const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0

export const isCustomTrackerGoal = (goal: unknown): goal is CustomTrackerGoal => {
  if (!goal || typeof goal !== 'object') return false
  const candidate = goal as { kind?: unknown; target?: unknown; targetMinutes?: unknown }
  if (candidate.kind === 'once') return true
  if (candidate.kind === 'count') return isPositiveInt(candidate.target)
  if (candidate.kind === 'duration') return isPositiveInt(candidate.targetMinutes)
  return false
}

const validTracker = (tracker: unknown): tracker is CustomTracker => {
  if (!tracker || typeof tracker !== 'object') return false
  const candidate = tracker as Partial<CustomTracker>
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return false
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return false
  if (typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt)) return false
  return isCustomTrackerGoal(candidate.goal)
}

const validEvent = (event: unknown): event is CustomEvent => {
  if (!event || typeof event !== 'object') return false
  const candidate = event as Partial<CustomEvent>
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return false
  if (typeof candidate.trackerId !== 'string' || !candidate.trackerId.trim()) return false
  return typeof candidate.at === 'number' && Number.isFinite(candidate.at)
}

/** Newest definitions last, so Today's needs lists them in the order created. */
export const normalizeCustomTrackers = (trackers: CustomTracker[]): CustomTracker[] =>
  trackers
    .filter(validTracker)
    .filter((tracker, index, all) => all.findIndex((other) => other.id === tracker.id) === index)
    .sort((a, b) => a.createdAt - b.createdAt)

/** Newest events first, matching every other collection in the app. */
export const normalizeCustomEvents = (events: CustomEvent[]): CustomEvent[] =>
  events
    .filter(validEvent)
    .filter((event, index, all) => all.findIndex((other) => other.id === event.id) === index)
    .sort((a, b) => b.at - a.at)

export const activeCustomTrackers = (trackers: CustomTracker[]) => trackers.filter((tracker) => !tracker.archivedAt)

export const canAddCustomTracker = (trackers: CustomTracker[]) => activeCustomTrackers(trackers).length < CUSTOM_TRACKER_LIMIT

const startOfDay = (at: number) => { const date = new Date(at); date.setHours(0, 0, 0, 0); return date.getTime() }

/**
 * What a tracker has achieved on a given day, and whether that meets its goal.
 *
 * Progress is measured against the goal as it stands now, but a caregiver who
 * tightens a goal should not find yesterday retroactively unmet — so an event
 * that recorded the goal it was logged under keeps it, and history is read
 * against that.
 */
export const customTrackerProgress = (tracker: CustomTracker, events: CustomEvent[], dayAnchorMs: number) => {
  const dayStart = startOfDay(dayAnchorMs)
  const dayEnd = dayStart + 86_400_000
  const forDay = events.filter((event) => event.trackerId === tracker.id && event.at >= dayStart && event.at < dayEnd)
  const goal = forDay[0]?.goalAtLog ?? tracker.goal

  if (goal.kind === 'once') return { goal, count: forDay.length, minutes: 0, done: forDay.length > 0, target: 1, value: Math.min(forDay.length, 1) }
  if (goal.kind === 'count') return { goal, count: forDay.length, minutes: 0, done: forDay.length >= goal.target, target: goal.target, value: forDay.length }

  const minutes = Math.round(forDay.reduce((total, event) => total + (event.durationSeconds ?? 0), 0) / 60)
  return { goal, count: forDay.length, minutes, done: minutes >= goal.targetMinutes, target: goal.targetMinutes, value: minutes }
}

export type CustomTrackerDay = { label: string; startMs: number; endMs: number; value: number; goalPercent: number; met: boolean }

export type CustomTrackerStats = {
  tracker: CustomTracker
  days: CustomTrackerDay[]
  unit: string
  /** What "one" means on the chart: a log, or a minute. */
  total: number
  averagePerDay: number
  goalDays: number
  bestDay: { label: string; value: number }
  target: number
}

/**
 * A tracker's history over the stats range, in the same shape the built-in
 * cards already chart, so the existing bar and trend instruments render it
 * without a second set of components to keep in step.
 *
 * Days are measured against the goal recorded on the events of that day, so a
 * goal raised today does not repaint last week as a run of failures.
 */
export function customTrackerStats(
  tracker: CustomTracker,
  events: CustomEvent[],
  windows: Array<{ label: string; startMs: number; endMs: number }>,
): CustomTrackerStats {
  const isDuration = tracker.goal.kind === 'duration'
  const days = windows.map((window) => {
    const progress = customTrackerProgress(tracker, events, window.startMs)
    const value = isDuration ? progress.minutes : progress.count
    return {
      label: window.label,
      startMs: window.startMs,
      endMs: window.endMs,
      value,
      goalPercent: Math.min(100, Math.round((value / Math.max(1, progress.target)) * 100)),
      met: progress.done,
    }
  })
  const total = days.reduce((sum, day) => sum + day.value, 0)
  const target = tracker.goal.kind === 'count' ? tracker.goal.target : tracker.goal.kind === 'duration' ? tracker.goal.targetMinutes : 1
  return {
    tracker,
    days,
    unit: isDuration ? 'm' : '',
    total,
    averagePerDay: days.length ? Math.round((total / days.length) * 10) / 10 : 0,
    goalDays: days.filter((day) => day.met).length,
    bestDay: days.reduce((best, day) => (day.value > best.value ? { label: day.label, value: day.value } : best), { label: 'Not yet', value: 0 }),
    target,
  }
}
