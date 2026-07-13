import type { HourWindow } from '../state/notificationPreferences'

export function isWithinWindow(now: number, window: HourWindow): boolean {
  const date = new Date(now)
  const currentHour = date.getHours()
  const { startHour, endHour } = window

  // If window doesn't wrap midnight (e.g., 8–20)
  if (startHour <= endHour) {
    return currentHour >= startHour && currentHour < endHour
  }

  // Window wraps midnight (e.g., 22–7): hour is in range if >= startHour OR < endHour
  return currentHour >= startHour || currentHour < endHour
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
