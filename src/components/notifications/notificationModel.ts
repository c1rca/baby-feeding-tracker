import type { MedicineKind } from '../../types'
import type { CustomTrackerReminderDue } from '../../domain/customTrackerReminders'
import type { MedicineReminder } from '../MedicineReminderBanner'
import type { NotificationPreferences } from '../../state/notificationPreferences'
import { isQuietHour, isWithinWindow } from '../../domain/notificationWindows'

export type CareNotification = {
  id: string
  kind: 'medicine' | 'vitamin_d' | 'tummy_time' | 'custom'
  priority: 1 | 2 | 3
  title: string
  summary: string
  actionLabel: string
  ariaActionLabel: string
  announcedRole: 'alert' | 'status'
  dismissible: boolean
  occurredAt: number
  action: () => void
  dismiss?: () => void
}

type BuildCareNotificationsInput = {
  medicineReminders?: MedicineReminder[]
  showMedicineReminder: boolean
  dismissMedicineReminder: (id: string) => void
  logMedicine: (kind: MedicineKind, name?: string) => void
  tummyTimeReminder: { copy: string } | null
  startTummyTime: () => void
  customTrackerReminders?: CustomTrackerReminderDue[]
  logCustomEvent?: (trackerId: string) => void
  preferences?: NotificationPreferences
  now?: number
}

const medicineNotification = (reminder: MedicineReminder, logMedicine: (kind: MedicineKind) => void, dismissMedicineReminder: (id: string) => void): CareNotification => {
  const isVitaminD = reminder.type === 'vitamin_d'
  const title = isVitaminD ? 'Vitamin D reminder' : 'Medicine reminder'
  const summary = isVitaminD
    ? reminder.elapsedHours === 0 ? 'Take Vitamin D. It has not been logged today.' : `Take Vitamin D. Last dose was ${reminder.elapsedHours}+ hours ago.`
    : `Take ${reminder.recommendedLabel}. Last dose was ${reminder.label} ${reminder.elapsedHours}+ hours ago.`
  return {
    id: reminder.id,
    kind: reminder.type,
    priority: isVitaminD ? 2 : 1,
    title,
    summary,
    actionLabel: `Log ${reminder.recommendedLabel}`,
    ariaActionLabel: `Log ${reminder.recommendedLabel} now`,
    announcedRole: 'alert',
    dismissible: true,
    occurredAt: reminder.at,
    action: () => logMedicine(reminder.recommendedKind),
    dismiss: () => dismissMedicineReminder(reminder.id),
  }
}

export const buildCareNotifications = ({ medicineReminders = [], showMedicineReminder, dismissMedicineReminder, logMedicine, tummyTimeReminder, startTummyTime, customTrackerReminders = [], logCustomEvent, preferences, now }: BuildCareNotificationsInput): CareNotification[] => {
  const isQuietNow = now && preferences ? isQuietHour(now, preferences.quietHours) : false

  const notifications: CareNotification[] = []

  // Medicine reminders: filter by inApp preference and quiet hours
  if (showMedicineReminder && !isQuietNow) {
    const filteredReminders = medicineReminders.filter((reminder) => {
      if (reminder.recommendedKind === 'vitamin_d') {
        return preferences?.vitaminD.inApp ?? true
      }
      return preferences?.[reminder.recommendedKind as 'tylenol' | 'motrin']?.inApp ?? true
    })
    notifications.push(...filteredReminders.map((reminder) => medicineNotification(reminder, logMedicine, dismissMedicineReminder)))
  }

  // Tummy time reminder: filter by inApp, quiet hours, and active window
  if (tummyTimeReminder && !isQuietNow) {
    const tummyPref = preferences?.tummyTime.inApp ?? true
    const isInActiveWindow = !now ? true : isWithinWindow(now, preferences?.tummyActiveHours ?? { startHour: 8, endHour: 20 })
    if (tummyPref && isInActiveWindow) {
      notifications.push({
        id: 'tummy-time', kind: 'tummy_time', priority: 3, title: 'Tummy Time reminder', summary: tummyTimeReminder.copy,
        actionLabel: 'Start Tummy Time', ariaActionLabel: 'Start Tummy Time from reminder', announcedRole: 'status', dismissible: false,
        occurredAt: Number.MAX_SAFE_INTEGER, action: startTummyTime,
      })
    }
  }

  // Caregiver-defined trackers. Quiet hours and goal-met are already applied
  // upstream; only the channel preference is left to check.
  if (preferences?.customTrackers.inApp ?? false) {
    notifications.push(...customTrackerReminders.map((reminder) => ({
      id: reminder.id,
      kind: 'custom' as const,
      priority: 3 as const,
      title: `${reminder.name} reminder`,
      summary: reminder.copy,
      actionLabel: `Log ${reminder.name}`,
      ariaActionLabel: `Log ${reminder.name} from reminder`,
      announcedRole: 'status' as const,
      dismissible: false,
      occurredAt: Number.MAX_SAFE_INTEGER,
      action: () => logCustomEvent?.(reminder.trackerId),
    })))
  }

  return notifications.sort((a, b) => a.priority - b.priority || a.occurredAt - b.occurredAt || a.id.localeCompare(b.id))
}

export const careNotificationSummary = (notifications: CareNotification[]) => {
  if (notifications.length === 0) return ''
  if (notifications.length === 1) return notifications[0].summary
  return `${notifications.length} care reminders · ${notifications.slice(0, 2).map((item) => item.actionLabel.replace('Log ', '').replace('Start ', '')).join(' · ')}`
}
