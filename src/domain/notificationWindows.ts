import type { HourWindow } from '../state/notificationPreferences'

export function isWithinWindow(now: number, window: HourWindow): boolean {
  const date = new Date(now)
  const currentMinute = date.getHours() * 60 + date.getMinutes()
  const startMinute = window.startHour * 60 + (window.startMinute ?? 0)
  const endMinute = window.endHour * 60 + (window.endMinute ?? 0)

  // Half-open interval [start, end): a zero-width window (start === end) is
  // empty, so nothing is ever within it. This is the least-surprising reading
  // of a range whose endpoints coincide.
  if (startMinute === endMinute) return false
  if (startMinute < endMinute) return currentMinute >= startMinute && currentMinute < endMinute
  return currentMinute >= startMinute || currentMinute < endMinute
}

export function isQuietHour(now: number, quietHours: { enabled: boolean; startHour: number; endHour: number }): boolean {
  if (!quietHours.enabled) return false
  return isWithinWindow(now, { startHour: quietHours.startHour, endHour: quietHours.endHour })
}

export function millisecondsUntilWindowChange(now: number, window: HourWindow): number | null {
  const currentState = isWithinWindow(now, window)
  const minuteMs = 60 * 1000
  const firstBoundary = Math.floor(now / minuteMs) * minuteMs + minuteMs
  for (let index = 0; index <= 26 * 60; index += 1) {
    const candidate = firstBoundary + index * minuteMs
    if (isWithinWindow(candidate, window) !== currentState) return candidate - now
  }
  return null
}
