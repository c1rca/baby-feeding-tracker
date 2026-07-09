import type { TummyTimeEvent } from '../types'

export const TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES = 20
export const normalizeTummyTimeGoalMinutes = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(numeric)) return TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES
  return Math.min(240, Math.max(1, Math.round(numeric)))
}
const DAY_MS = 24 * 60 * 60 * 1000
const TUMMY_TIME_RECENT_SESSION_COOLDOWN_MS = 3 * 60 * 60 * 1000

export function startOfLocalDayMs(timestamp: number) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function tummyTimesToday(tummyTimes: TummyTimeEvent[], now: number) {
  const start = startOfLocalDayMs(now)
  const end = start + DAY_MS
  return tummyTimes.filter((event) => event.startedAt >= start && event.startedAt < end)
}

export function shouldShowTummyTimeReminder(tummyTimes: TummyTimeEvent[], tummySession: unknown, now: number, goalMinutes = TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES) {
  const dailyGoalMinutes = normalizeTummyTimeGoalMinutes(goalMinutes)
  if (tummySession) return false
  const todayTummyTimes = tummyTimesToday(tummyTimes, now)
  const todayMinutes = tummyTimeMinutesToday(tummyTimes, now)
  if (todayMinutes >= dailyGoalMinutes) return false
  const hour = new Date(now).getHours()
  if (hour < 8 || hour >= 20) return false
  const latestEndedAt = Math.max(0, ...todayTummyTimes.map((event) => event.endedAt))
  if (hour < 18 && latestEndedAt > 0 && now - latestEndedAt < TUMMY_TIME_RECENT_SESSION_COOLDOWN_MS) return false
  const expectedMinutesByNow = Math.min(dailyGoalMinutes, Math.max(5, Math.floor((hour - 6) / 3) * 5))
  return todayMinutes < expectedMinutesByNow
}

export function tummyTimeReminderCopy(tummyTimes: TummyTimeEvent[], now: number, goalMinutes = TUMMY_TIME_DEFAULT_DAILY_GOAL_MINUTES) {
  const dailyGoalMinutes = normalizeTummyTimeGoalMinutes(goalMinutes)
  const minutes = tummyTimeMinutesToday(tummyTimes, now)
  return `Tummy Time ${minutes}/${dailyGoalMinutes} min today. Aim for ${dailyGoalMinutes} minutes total.`
}

export function tummyTimeDurationSeconds(event: TummyTimeEvent) {
  return Math.max(0, Math.round((event.endedAt - event.startedAt) / 1000))
}

export function tummyTimeMinutesToday(tummyTimes: TummyTimeEvent[], now: number) {
  return tummyTimesToday(tummyTimes, now).reduce((total, event) => total + Math.round(tummyTimeDurationSeconds(event) / 60), 0)
}
