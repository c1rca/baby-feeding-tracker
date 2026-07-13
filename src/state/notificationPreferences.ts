export type ChannelPrefs = { inApp: boolean; browser: boolean; gotify: boolean }
export type HourWindow = { startHour: number; endHour: number }

export type NotificationPreferences = {
  feeding: ChannelPrefs
  tylenol: ChannelPrefs
  motrin: ChannelPrefs
  vitaminD: ChannelPrefs
  tummyTime: ChannelPrefs
  tummyActiveHours: HourWindow
  quietHours: { enabled: boolean } & HourWindow
  medicineIntervals: { tylenol: 0 | 4 | 6; motrin: 0 | 4 | 6 }
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  feeding: { inApp: false, browser: true, gotify: true },
  tylenol: { inApp: true, browser: false, gotify: true },
  motrin: { inApp: true, browser: false, gotify: true },
  vitaminD: { inApp: true, browser: false, gotify: true },
  tummyTime: { inApp: true, browser: false, gotify: false },
  tummyActiveHours: { startHour: 8, endHour: 20 },
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
  medicineIntervals: { tylenol: 6, motrin: 6 },
}

const normalizeHourWindow = (window?: Partial<HourWindow>): HourWindow => {
  const start = Math.max(0, Math.min(23, Math.round(Number(window?.startHour) || 0)))
  const end = Math.max(0, Math.min(23, Math.round(Number(window?.endHour) || 0)))
  return { startHour: start, endHour: end }
}

const normalizeChannelPrefs = (prefs?: Partial<ChannelPrefs>): ChannelPrefs => ({
  inApp: Boolean(prefs?.inApp),
  browser: Boolean(prefs?.browser),
  gotify: Boolean(prefs?.gotify),
})

const normalizeInterval = (value?: number): 0 | 4 | 6 => {
  const num = Number(value)
  return num === 0 || num === 4 || num === 6 ? num : 6
}

export const normalizeNotificationPreferences = (prefs?: Partial<NotificationPreferences>): NotificationPreferences => {
  return {
    feeding: normalizeChannelPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES.feeding, ...prefs?.feeding }),
    tylenol: normalizeChannelPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES.tylenol, ...prefs?.tylenol }),
    motrin: normalizeChannelPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES.motrin, ...prefs?.motrin }),
    vitaminD: normalizeChannelPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES.vitaminD, ...prefs?.vitaminD }),
    tummyTime: normalizeChannelPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES.tummyTime, ...prefs?.tummyTime }),
    tummyActiveHours: normalizeHourWindow({ ...DEFAULT_NOTIFICATION_PREFERENCES.tummyActiveHours, ...prefs?.tummyActiveHours }),
    quietHours: {
      enabled: Boolean(prefs?.quietHours?.enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHours.enabled),
      ...normalizeHourWindow({ ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours, ...prefs?.quietHours }),
    },
    medicineIntervals: {
      tylenol: normalizeInterval(prefs?.medicineIntervals?.tylenol),
      motrin: normalizeInterval(prefs?.medicineIntervals?.motrin),
    },
  }
}
