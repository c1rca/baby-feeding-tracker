export function getZonedMinuteOfDay(now, timeZone = 'America/New_York') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return value('hour') * 60 + value('minute')
}

export function getZonedHour(now, timeZone = 'America/New_York') {
  return Math.floor(getZonedMinuteOfDay(now, timeZone) / 60)
}

export function isWithinWindow(now, window, timeZone = 'America/New_York') {
  const currentMinute = getZonedMinuteOfDay(now, timeZone)
  const startMinute = Number(window.startHour) * 60 + Number(window.startMinute ?? 0)
  const endMinute = Number(window.endHour) * 60 + Number(window.endMinute ?? 0)

  if (startMinute === endMinute) return true
  if (startMinute < endMinute) return currentMinute >= startMinute && currentMinute < endMinute
  return currentMinute >= startMinute || currentMinute < endMinute
}

export function isQuietHour(now, quietHours, timeZone = 'America/New_York') {
  if (!quietHours?.enabled) return false
  return isWithinWindow(now, { startHour: quietHours.startHour, endHour: quietHours.endHour }, timeZone)
}

export function millisecondsUntilWindowChange(now, window, timeZone = 'America/New_York') {
  const currentState = isWithinWindow(now, window, timeZone)
  const minute = 60 * 1000
  const firstBoundary = Math.floor(now / minute) * minute + minute
  const maxMinutes = 26 * 60
  for (let index = 0; index <= maxMinutes; index += 1) {
    const candidate = firstBoundary + index * minute
    if (isWithinWindow(candidate, window, timeZone) !== currentState) return candidate - now
  }
  return null
}
