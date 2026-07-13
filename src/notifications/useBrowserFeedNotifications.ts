import { useEffect } from 'react'
import type { Entry } from '../types'
import type { MedicineReminder } from '../components/MedicineReminderBanner'
import type { NotificationPreferences } from '../state/notificationPreferences'
import { isQuietHour, isWithinWindow } from '../domain/notificationWindows'

const NOTIFICATION_APP_URL = import.meta.env.VITE_NOTIFICATION_APP_URL || window.location.origin

type BrowserRemindersOptions = {
  browserRemindersEnabled: boolean
  notificationPermission: NotificationPermission | 'unsupported'
  preferences?: NotificationPreferences
  now?: number
  lastFeed?: Entry
  medicineReminders?: MedicineReminder[]
  tummyTimeReminder?: { copy: string } | null
}

function scheduleNotification(title: string, body: string, tag: string, delayMs: number, requireInteraction = false, shouldNotify: () => boolean = () => true): ReturnType<typeof setTimeout> {
  return window.setTimeout(() => {
    if (typeof Notification === 'undefined' || !shouldNotify()) return
    const notification = new Notification(title, { body, tag, requireInteraction })
    notification.onclick = () => {
      window.open(NOTIFICATION_APP_URL, '_blank', 'noopener,noreferrer')
      notification.close()
    }
  }, delayMs)
}

export function useBrowserFeedNotifications({ browserRemindersEnabled, notificationPermission, preferences, now, lastFeed, medicineReminders = [], tummyTimeReminder }: BrowserRemindersOptions) {
  useEffect(() => {
    if (!browserRemindersEnabled || notificationPermission !== 'granted' || !now || typeof Notification === 'undefined') return
    if (!preferences) return // No preferences loaded yet

    const isQuietNow = isQuietHour(now, preferences.quietHours)
    const canNotifyNow = () => !isQuietHour(Date.now(), preferences.quietHours)
    const timers: ReturnType<typeof setTimeout>[] = []

    // Feeding reminders
    if (!isQuietNow && preferences.feeding.browser && lastFeed && (preferences.reminderIntervals?.feeding ?? 2) > 0) {
      const hours = preferences.reminderIntervals?.feeding ?? 2
      const delayMs = lastFeed.startedAt + hours * 60 * 60 * 1000 - now
      if (delayMs > 0) timers.push(scheduleNotification(
        'Feeding reminder',
        `${hours} hours since the last feed started. Open Feedr to log or resume.`,
        `next-feeding-${lastFeed.id}-${hours}h`,
        delayMs,
        true,
        canNotifyNow
      ))
    }

    // Medicine reminders (Tylenol and Motrin)
    if (!isQuietNow && medicineReminders.length > 0) {
      medicineReminders.forEach((reminder) => {
        const kind = reminder.type as 'tylenol' | 'motrin'
        if (preferences[kind]?.browser) {
          const delayMs = reminder.at + (preferences.medicineIntervals[kind] * 60 * 60 * 1000) - now
          if (delayMs > 0) {
            const hours = preferences.medicineIntervals[kind]
            timers.push(scheduleNotification(
              `${reminder.recommendedLabel} reminder`,
              `Last dose was ${hours} hours ago. Open Feedr to log the next dose.`,
              `medicine-${reminder.id}-${kind}`,
              delayMs,
              false,
              canNotifyNow
            ))
          }
        }
      })
    }

    // Tummy Time reminders
    if (!isQuietNow && preferences.tummyTime.browser && tummyTimeReminder && isWithinWindow(now, preferences.tummyActiveHours)) {
      timers.push(scheduleNotification(
        'Tummy Time reminder',
        tummyTimeReminder.copy,
        'tummy-time-reminder',
        0,
        false,
        canNotifyNow
      ))
    }

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [browserRemindersEnabled, notificationPermission, preferences, now, lastFeed, medicineReminders, tummyTimeReminder])
}
