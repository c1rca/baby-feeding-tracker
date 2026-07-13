import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '../auth/authSession'
import { DEFAULT_MEDICINE_REMINDER_SETTINGS, normalizeMedicineReminderSettings, type MedicineReminderSettings } from '../state/medicineReminderModel'
import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences, type NotificationPreferences } from '../state/notificationPreferences'

const API_NOTIFICATION_SETTINGS = '/api/notification-settings'

type NotificationSettingsOptions = {
  setBrowserRemindersEnabled: (enabled: boolean) => void
  showToast: (message: string) => void
}

export function useNotificationSettings({ setBrowserRemindersEnabled, showToast }: NotificationSettingsOptions) {
  const [gotifyAvailable, setGotifyAvailable] = useState(false)
  const [gotifyRemindersEnabled, setGotifyRemindersEnabled] = useState(false)
  const [medicineReminderSettings, setMedicineReminderSettingsState] = useState<MedicineReminderSettings>(DEFAULT_MEDICINE_REMINDER_SETTINGS)
  const [medicineReminderSettingsLoaded, setMedicineReminderSettingsLoaded] = useState(false)
  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [notificationPreferencesLoaded, setNotificationPreferencesLoaded] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => (typeof Notification === 'undefined' ? 'denied' : Notification.permission))

  const loadGotifySettings = useCallback(async () => {
    try {
      const response = await authFetch(API_NOTIFICATION_SETTINGS)
      if (!response.ok) throw new Error('settings load failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean; medicineReminderSettings?: Partial<Record<keyof MedicineReminderSettings, number>>; notificationPreferences?: Partial<NotificationPreferences> }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      setMedicineReminderSettingsState(normalizeMedicineReminderSettings(data.medicineReminderSettings))
      setNotificationPreferencesState(normalizeNotificationPreferences(data.notificationPreferences))
      setMedicineReminderSettingsLoaded(true)
      setNotificationPreferencesLoaded(true)
    } catch {
      setGotifyAvailable(false)
      setMedicineReminderSettingsLoaded(true)
      setNotificationPreferencesLoaded(true)
    }
  }, [])

  useEffect(() => {
    window.setTimeout(() => void loadGotifySettings(), 0)
  }, [loadGotifySettings])

  const setGotifyReminders = async (enabled: boolean) => {
    try {
      const response = await authFetch(API_NOTIFICATION_SETTINGS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gotifyRemindersEnabled: enabled }),
      })
      if (!response.ok) throw new Error('settings save failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean; medicineReminderSettings?: Partial<Record<keyof MedicineReminderSettings, number>>; notificationPreferences?: Partial<NotificationPreferences> }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      setMedicineReminderSettingsState(normalizeMedicineReminderSettings(data.medicineReminderSettings))
      setNotificationPreferencesState(normalizeNotificationPreferences(data.notificationPreferences))
      showToast(data.gotifyRemindersEnabled ? 'Gotify reminders enabled' : 'Gotify reminders disabled')
    } catch {
      showToast('Could not update Gotify reminders')
    }
  }

  const setMedicineReminderSettings = async (settings: MedicineReminderSettings) => {
    const normalized = normalizeMedicineReminderSettings(settings)
    try {
      const response = await authFetch(API_NOTIFICATION_SETTINGS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicineReminderSettings: normalized }),
      })
      if (!response.ok) throw new Error('settings save failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean; medicineReminderSettings?: Partial<Record<keyof MedicineReminderSettings, number>>; notificationPreferences?: Partial<NotificationPreferences> }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      setMedicineReminderSettingsState(normalizeMedicineReminderSettings(data.medicineReminderSettings))
      setNotificationPreferencesState(normalizeNotificationPreferences(data.notificationPreferences))
      showToast('Medicine reminder settings saved')
    } catch {
      showToast('Could not update medicine reminder settings')
    }
  }

  const setNotificationPreferences = async (prefs: Partial<NotificationPreferences>) => {
    const merged = { ...notificationPreferences, ...prefs }
    const normalized = normalizeNotificationPreferences(merged)

    // Optimistic update
    setNotificationPreferencesState(normalized)

    try {
      const response = await authFetch(API_NOTIFICATION_SETTINGS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationPreferences: normalized }),
      })
      if (!response.ok) throw new Error('settings save failed')
      const data = (await response.json()) as { available?: boolean; gotifyRemindersEnabled?: boolean; medicineReminderSettings?: Partial<Record<keyof MedicineReminderSettings, number>>; notificationPreferences?: Partial<NotificationPreferences> }
      setGotifyAvailable(Boolean(data.available))
      setGotifyRemindersEnabled(Boolean(data.gotifyRemindersEnabled))
      setMedicineReminderSettingsState(normalizeMedicineReminderSettings(data.medicineReminderSettings))
      setNotificationPreferencesState(normalizeNotificationPreferences(data.notificationPreferences))
      showToast('Notification settings saved')
    } catch {
      // Revert on error
      setNotificationPreferencesState(notificationPreferences)
      showToast('Could not update notification settings')
    }
  }

  const enableBrowserReminders = async () => {
    if (typeof Notification === 'undefined') return showToast('Notifications are not supported in this browser')
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
    setNotificationPermission(permission)
    if (permission !== 'granted') {
      setBrowserRemindersEnabled(false)
      return showToast('Notification permission not granted')
    }
    setBrowserRemindersEnabled(true)
    showToast('Browser reminders enabled')
  }

  return {
    gotifyAvailable,
    gotifyRemindersEnabled,
    medicineReminderSettings,
    medicineReminderSettingsLoaded,
    notificationPreferences,
    notificationPreferencesLoaded,
    notificationPermission,
    setGotifyReminders,
    setMedicineReminderSettings,
    setNotificationPreferences,
    enableBrowserReminders,
  }
}
