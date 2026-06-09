import { useCallback, useEffect, useState } from 'react'

const API_NOTIFICATION_SETTINGS = '/api/notification-settings'

type NotificationSettingsOptions = {
  setFeedingNotificationsEnabled: (enabled: boolean) => void
  showToast: (message: string) => void
}

export function useNotificationSettings({ setFeedingNotificationsEnabled, showToast }: NotificationSettingsOptions) {
  const [gotifyAvailable, setGotifyAvailable] = useState(false)
  const [gotifyRemindersEnabled, setGotifyRemindersEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (typeof Notification === 'undefined' ? 'denied' : Notification.permission))

  const loadGotifySettings = useCallback(async () => {
    try {
      const response = await fetch(API_NOTIFICATION_SETTINGS)
      if (!response.ok) throw new Error('settings load failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
    } catch {
      setGotifyAvailable(false)
    }
  }, [])

  useEffect(() => {
    window.setTimeout(() => void loadGotifySettings(), 0)
  }, [loadGotifySettings])

  const setGotifyReminders = async (enabled: boolean) => {
    try {
      const response = await fetch(API_NOTIFICATION_SETTINGS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gotifyRemindersEnabled: enabled }),
      })
      if (!response.ok) throw new Error('settings save failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      showToast(data.gotifyRemindersEnabled ? 'Gotify reminders enabled' : 'Gotify reminders disabled')
    } catch {
      showToast('Could not update Gotify reminders')
    }
  }

  const enableFeedingNotifications = async () => {
    if (typeof Notification === 'undefined') return showToast('Notifications are not supported in this browser')
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    setNotificationPermission(permission)
    if (permission !== 'granted') {
      setFeedingNotificationsEnabled(false)
      return showToast('Notification permission not granted')
    }
    setFeedingNotificationsEnabled(true)
    showToast('Feeding reminders enabled')
  }

  return {
    gotifyAvailable,
    gotifyRemindersEnabled,
    notificationPermission,
    setGotifyReminders,
    enableFeedingNotifications,
  }
}
