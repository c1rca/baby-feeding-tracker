import type { TummyTimeEvent } from '../types'

export const TUMMY_TIME_DAILY_GOAL = 4
const DAY_MS = 24 * 60 * 60 * 1000

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
  const todayCount = tummyTimesToday(tummyTimes, now).length
  if (todayCount >= TUMMY_TIME_DAILY_GOAL) return false
  const hour = new Date(now).getHours()
  if (hour < 8 || hour >= 20) return false
  const expectedByNow = Math.min(TUMMY_TIME_DAILY_GOAL, Math.max(1, Math.floor((hour - 8) / 3) + 1))
  return todayCount < expectedByNow
}

export function tummyTimeReminderCopy(tummyTimes: TummyTimeEvent[], now: number) {
  const count = tummyTimesToday(tummyTimes, now).length
  return `Tummy Time ${count}/${TUMMY_TIME_DAILY_GOAL} today. Aim for ${TUMMY_TIME_DAILY_GOAL} short sessions.`
}

export function tummyTimeDurationSeconds(event: TummyTimeEvent) {
  return Math.max(0, Math.round((event.endedAt - event.startedAt) / 1000))
}
