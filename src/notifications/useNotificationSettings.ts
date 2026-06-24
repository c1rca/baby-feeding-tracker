import { useCallback, useEffect, useState } from 'react'

const API_NOTIFICATION_SETTINGS = '/api/notification-settings'

type MedicineReminderSettings = { tylenol: 0 | 4 | 6; motrin: 0 | 4 | 6 }
const DEFAULT_MEDICINE_REMINDER_SETTINGS: MedicineReminderSettings = { tylenol: 6, motrin: 6 }
const normalizeMedicineReminderSettings = (settings?: Partial<Record<keyof MedicineReminderSettings, number>>): MedicineReminderSettings => {
  const intervalFor = (kind: keyof MedicineReminderSettings): 0 | 4 | 6 => {
    const value = Number(settings?.[kind])
    return value === 0 || value === 4 || value === 6 ? value : 6
  }
  return { tylenol: intervalFor('tylenol'), motrin: intervalFor('motrin') }
}

type NotificationSettingsOptions = {
  setFeedingNotificationsEnabled: (enabled: boolean) => void
  showToast: (message: string) => void
}

export function useNotificationSettings({ setFeedingNotificationsEnabled, showToast }: NotificationSettingsOptions) {
  const [gotifyAvailable, setGotifyAvailable] = useState(false)
  const [gotifyRemindersEnabled, setGotifyRemindersEnabled] = useState(false)
  const [medicineReminderSettings, setMedicineReminderSettingsState] = useState<MedicineReminderSettings>(DEFAULT_MEDICINE_REMINDER_SETTINGS)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (typeof Notification === 'undefined' ? 'denied' : Notification.permission))

  const loadGotifySettings = useCallback(async () => {
    try {
      const response = await fetch(API_NOTIFICATION_SETTINGS)
      if (!response.ok) throw new Error('settings load failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean; medicineReminderSettings?: Partial<Record<keyof MedicineReminderSettings, number>> }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      setMedicineReminderSettingsState(normalizeMedicineReminderSettings(data.medicineReminderSettings))
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
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean; medicineReminderSettings?: Partial<Record<keyof MedicineReminderSettings, number>> }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      setMedicineReminderSettingsState(normalizeMedicineReminderSettings(data.medicineReminderSettings))
      showToast(data.gotifyRemindersEnabled ? 'Gotify reminders enabled' : 'Gotify reminders disabled')
    } catch {
      showToast('Could not update Gotify reminders')
    }
  }

  const setMedicineReminderSettings = async (settings: MedicineReminderSettings) => {
    const normalized = normalizeMedicineReminderSettings(settings)
    try {
      const response = await fetch(API_NOTIFICATION_SETTINGS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicineReminderSettings: normalized }),
      })
      if (!response.ok) throw new Error('settings save failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean; medicineReminderSettings?: Partial<Record<keyof MedicineReminderSettings, number>> }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      setMedicineReminderSettingsState(normalizeMedicineReminderSettings(data.medicineReminderSettings))
      showToast('Medicine reminder settings saved')
    } catch {
      showToast('Could not update medicine reminder settings')
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
    medicineReminderSettings,
    notificationPermission,
    setGotifyReminders,
    setMedicineReminderSettings,
    enableFeedingNotifications,
  }
}
