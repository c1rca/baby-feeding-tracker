const DAY_MS = 24 * 60 * 60 * 1000

export { DAY_MS }

export const startOfLocalDay = (timestamp: number) => {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date
}

export const addLocalDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const localDayWindow = (timestamp: number, offsetDays = 0) => {
  const start = addLocalDays(startOfLocalDay(timestamp), offsetDays)
  const end = addLocalDays(start, 1)
  return { start, end, startMs: start.getTime(), endMs: end.getTime(), label: start.toLocaleDateString([], { weekday: 'short' }) }
}

export const localDayWindows = (timestamp: number, days: number) =>
  Array.from({ length: days }, (_, index) => localDayWindow(timestamp, index - (days - 1)))

export const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export const formatShortTimeRange = (start: number, end: number) => {
  const startText = formatTime(start)
  const endText = formatTime(end)
  const startParts = startText.match(/^(.*)\s([AP]M)$/i)
  const endParts = endText.match(/^(.*)\s([AP]M)$/i)
  if (startParts && endParts && startParts[2] === endParts[2]) return `${startParts[1]}–${endParts[1]} ${endParts[2]}`
  return `${startText}–${endText}`
}

export const formatClockInput = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export const formatDateInput = (timestamp: number) => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatTimeInput = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export const parseDateAndTime = (dateValue: string, timeValue: string) => {
  if (!dateValue || !timeValue) return null
  const parsed = new Date(`${dateValue}T${timeValue}`)
  const timestamp = parsed.getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

// Timeline rows sit under a sticky day-group header that already carries the
// date, so each row only needs the time — no repeated "Sat, Jul 11" prefix.
export const formatTimelineTimestamp = (timestamp: number) => ({ primary: formatTime(timestamp) })

export const parseClockTimeToday = (value: string, referenceTime: number) => {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, '')
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    hours = hours % 12 + (meridiem === 'pm' ? 12 : 0)
  } else if (hours > 23) {
    return null
  }

  const parsed = new Date(referenceTime)
  parsed.setHours(hours, minutes, 0, 0)
  if (parsed.getTime() > referenceTime) parsed.setDate(parsed.getDate() - 1)
  return parsed.getTime()
}

export const formatMinutesAgo = (minutes: number) => `${Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60}m ago`
export const formatAvgGapShort = (minutes: number) => `Avg ${Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60}m`
