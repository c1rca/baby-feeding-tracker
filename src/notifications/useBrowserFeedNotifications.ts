import { useEffect } from 'react'
import type { Entry } from '../types'

const NOTIFICATION_APP_URL = 'https://feedr.kjw.lol'
const NEXT_FEEDING_REMINDER_OFFSETS_MS = [2 * 60 * 60 * 1000, 3 * 60 * 60 * 1000]

type BrowserFeedNotificationsOptions = {
  feedingNotificationsEnabled: boolean
  notificationPermission: NotificationPermission | 'unsupported'
  lastFeed: Entry | undefined
}

export function useBrowserFeedNotifications({ feedingNotificationsEnabled, notificationPermission, lastFeed }: BrowserFeedNotificationsOptions) {
  useEffect(() => {
    if (!feedingNotificationsEnabled || notificationPermission !== 'granted' || !lastFeed || typeof Notification === 'undefined') return
    const timers = NEXT_FEEDING_REMINDER_OFFSETS_MS
      .map((offsetMs) => ({ offsetMs, delayMs: lastFeed.startedAt + offsetMs - new Date().getTime() }))
      .filter(({ delayMs }) => delayMs > 0)
      .map(({ offsetMs, delayMs }) => window.setTimeout(() => {
        const hours = Math.round(offsetMs / (60 * 60 * 1000))
        const notification = new Notification('Feeding window reminder', {
          body: `${hours} hours since the last feed started. Open Feedr to log or resume.`,
          tag: `next-feeding-${lastFeed.id}-${hours}h`,
          requireInteraction: hours === 3,
        })
        notification.onclick = () => {
          window.open(NOTIFICATION_APP_URL, '_blank', 'noopener,noreferrer')
          notification.close()
        }
      }, delayMs))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [feedingNotificationsEnabled, lastFeed, notificationPermission])
}
