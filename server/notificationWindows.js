export function getZonedHour(now, timeZone = 'America/New_York') {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(now))
}

export function isWithinWindow(now, window, timeZone = 'America/New_York') {
  const currentHour = getZonedHour(now, timeZone)
  const { startHour, endHour } = window

  if (startHour === endHour) return true
  if (startHour < endHour) return currentHour >= startHour && currentHour < endHour
  return currentHour >= startHour || currentHour < endHour
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
