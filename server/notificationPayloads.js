import { FEEDR_URL } from './notificationConstants.js'
import { buildMedicineQuickLogUrl, formatTime, medicationLabel } from './notificationFormatting.js'

export function buildMedicineNotificationPayload(reminder) {
  const medicineLabelText = medicationLabel(reminder.recommendedKind)
  const quickLogUrl = buildMedicineQuickLogUrl(reminder.recommendedKind)
  const intervalHours = reminder.intervalHours ?? 6
  const title = reminder.recommendedKind === 'vitamin_d' ? 'Vitamin D reminder' : 'Medicine reminder'
  return {
    title,
    subject: title,
    message: `Take ${medicineLabelText}. Last dose was ${medicationLabel(reminder.medicineKind)} ${intervalHours}+ hours ago.\n\nLog ${medicineLabelText} now: ${quickLogUrl}`,
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
