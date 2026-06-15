import { FEEDR_URL } from './notificationConstants.js'
import { buildMedicineQuickLogUrl, formatTime, medicationLabel } from './notificationFormatting.js'

export function buildMedicineNotificationPayload(reminder) {
  const medicineLabelText = medicationLabel(reminder.recommendedKind)
  const quickLogUrl = buildMedicineQuickLogUrl(reminder.recommendedKind)
  return {
    title: 'Medicine reminder',
    subject: 'Medicine reminder',
    message: `Take ${medicineLabelText}. Last dose was ${medicationLabel(reminder.medicineKind)} 6+ hours ago.\n\nLog ${medicineLabelText} now: ${quickLogUrl}`,
    priority: 5,
    extras: {
      'client::notification': { click: { url: quickLogUrl } },
    },
  }
}

export function buildFeedingNotificationPayload(reminder, timeZone) {
  return {
    title: 'Feeding reminder',
    message: `Next feeding window is open (${formatTime(reminder.dueAt, timeZone)}–${formatTime(reminder.windowEndAt, timeZone)}).\n\n${FEEDR_URL}`,
    priority: 5,
  }
}
