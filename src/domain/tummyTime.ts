import type { TummyTimeEvent } from '../types'

export const TUMMY_TIME_DAILY_GOAL_MINUTES = 20
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

export function shouldShowTummyTimeReminder(tummyTimes: TummyTimeEvent[], tummySession: unknown, now: number) {
  if (tummySession) return false
  const todayTummyTimes = tummyTimesToday(tummyTimes, now)
  const todayMinutes = tummyTimeMinutesToday(tummyTimes, now)
  if (todayMinutes >= TUMMY_TIME_DAILY_GOAL_MINUTES) return false
  const hour = new Date(now).getHours()
  if (hour < 8 || hour >= 20) return false
  const latestEndedAt = Math.max(0, ...todayTummyTimes.map((event) => event.endedAt))
  if (hour < 18 && latestEndedAt > 0 && now - latestEndedAt < TUMMY_TIME_RECENT_SESSION_COOLDOWN_MS) return false
  const expectedMinutesByNow = Math.min(TUMMY_TIME_DAILY_GOAL_MINUTES, Math.max(5, Math.floor((hour - 6) / 3) * 5))
  return todayMinutes < expectedMinutesByNow
}

export function tummyTimeReminderCopy(tummyTimes: TummyTimeEvent[], now: number) {
  const minutes = tummyTimeMinutesToday(tummyTimes, now)
  return `Tummy Time ${minutes}/${TUMMY_TIME_DAILY_GOAL_MINUTES} min today. Aim for ${TUMMY_TIME_DAILY_GOAL_MINUTES} minutes total.`
}

export function tummyTimeDurationSeconds(event: TummyTimeEvent) {
  return Math.max(0, Math.round((event.endedAt - event.startedAt) / 1000))
}

export function tummyTimeMinutesToday(tummyTimes: TummyTimeEvent[], now: number) {
  return tummyTimesToday(tummyTimes, now).reduce((total, event) => total + Math.round(tummyTimeDurationSeconds(event) / 60), 0)
}
