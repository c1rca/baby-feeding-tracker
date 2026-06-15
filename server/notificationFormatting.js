import { DEFAULT_TIME_ZONE, FEEDR_URL } from './notificationConstants.js'

export function normalizeTextEmailRecipients(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

export function medicationLabel(kind) {
  return kind === 'motrin' ? 'Motrin' : 'Tylenol'
}

export function buildMedicineQuickLogUrl(kind) {
  const medication = kind === 'motrin' ? 'motrin' : 'tylenol'
  return `${FEEDR_URL}/?quickMed=${medication}`
}

export function formatTime(timestamp, timeZone = process.env.FEEDING_TIME_ZONE || process.env.TZ || DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(timestamp))
}
