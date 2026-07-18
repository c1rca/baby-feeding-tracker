import { useEffect, useRef } from 'react'
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

function scheduleNotification(title: string, body: string, tag: string, delayMs: number, requireInteraction = false, shouldNotify: () => boolean = () => true, onDelivered: () => void = () => {}): ReturnType<typeof setTimeout> {
  return window.setTimeout(() => {
    if (typeof Notification === 'undefined' || !shouldNotify()) return
    const notification = new Notification(title, { body, tag, requireInteraction })
    onDelivered()
    notification.onclick = () => {
      window.open(NOTIFICATION_APP_URL, '_blank', 'noopener,noreferrer')
      notification.close()
    }
  }, delayMs)
}

export function useBrowserFeedNotifications({ browserRemindersEnabled, notificationPermission, preferences, now, lastFeed, medicineReminders = [], tummyTimeReminder }: BrowserRemindersOptions) {
  const deliveredDueTagsRef = useRef(new Set<string>())
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

    // Medicine + Vitamin D reminders arrive already due (getMedicineReminders
    // only returns overdue doses), so alert promptly on the browser channel —
    // mirroring the in-app path's kind→preference mapping (Vitamin D lives under
    // the `vitaminD` key). A stable tag means the per-second effect re-run
    // replaces the notification rather than stacking duplicates.
    if (!isQuietNow) {
      medicineReminders.forEach((reminder) => {
        const channel = reminder.recommendedKind === 'vitamin_d' ? preferences.vitaminD : preferences[reminder.recommendedKind]
        if (!channel?.browser) return
        const tag = `medicine-${reminder.id}-${reminder.recommendedKind}`
        if (deliveredDueTagsRef.current.has(tag)) return
        timers.push(scheduleNotification(
          `${reminder.recommendedLabel} reminder`,
          `Last dose was ${reminder.elapsedHours} hours ago. Open Feedr to log the next dose.`,
          tag,
          0,
          false,
          canNotifyNow,
          () => deliveredDueTagsRef.current.add(tag),
        ))
      })
    }

    // Tummy Time reminders
    if (!isQuietNow && preferences.tummyTime.browser && tummyTimeReminder && isWithinWindow(now, preferences.tummyActiveHours)) {
      const tag = `tummy-time-reminder:${tummyTimeReminder.copy}`
      if (!deliveredDueTagsRef.current.has(tag)) timers.push(scheduleNotification(
        'Tummy Time reminder',
        tummyTimeReminder.copy,
        tag,
        0,
        false,
        canNotifyNow,
        () => deliveredDueTagsRef.current.add(tag),
      ))
    }

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [browserRemindersEnabled, notificationPermission, preferences, now, lastFeed, medicineReminders, tummyTimeReminder])
}
