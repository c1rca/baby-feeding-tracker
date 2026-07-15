import type { RefObject } from 'react'
import type { DiaperEvent, Entry, Session } from '../../types'
import type { PastEventDraft } from '../../state/pastEventModels'
import type { AuthUser } from '../../auth/authApi'
import type { BabySummary } from '../../babies/babyApi'
import type { NotificationPreferences } from '../../state/notificationPreferences'

export type ManualDraft = { date: string; time: string; leftMinutes: string; rightMinutes: string; bottleOunces: string; note: string }

export type MedicineReminderSettings = { tylenol: 0 | 4 | 6; motrin: 0 | 4 | 6 }

export type TrackerModalsProps = {
  bottleOpen: boolean
  manualOpen: boolean
  pastEventOpen: boolean
  settingsOpen: boolean
  session: Session | null
  bottleQuickOz: number
  manualDraft: ManualDraft
  pastEventDraft: PastEventDraft
  entries: Entry[]
  diapers: DiaperEvent[]
  babyDob: string
  tummyGoalMinutes: number
  feedingNotificationsEnabled: boolean
  browserRemindersEnabled: boolean
  liveSyncEnabled: boolean
  notificationPermission: NotificationPermission
  notificationPreferences: NotificationPreferences
  gotifyAvailable: boolean
  gotifyRemindersEnabled: boolean
  medicineReminderSettings: MedicineReminderSettings
  babies?: BabySummary[]
  selectedBabyId?: string
  authUser?: AuthUser | null
  profileName?: string
  setProfileName?: (name: string) => void
  theme: 'light' | 'dark'
  onLogout?: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  setBottleOpen: (open: boolean) => void
  setManualOpen: (open: boolean) => void
  setPastEventOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setBottleQuickOz: (updater: (value: number) => number) => void
  setManualDraft: (draft: ManualDraft) => void
  setPastEventDraft: (draft: PastEventDraft | ((current: PastEventDraft) => PastEventDraft)) => void
  setEntries: (updater: Entry[] | ((prev: Entry[]) => Entry[])) => void
  setDiapers: (updater: DiaperEvent[] | ((prev: DiaperEvent[]) => DiaperEvent[])) => void
  setBabyDob: (dob: string) => void
  setTummyGoalMinutes: (minutes: number) => void
  setSession: (session: Session | null) => void
  setUndoState: (state: null) => void
  setFeedingNotificationsEnabled: (enabled: boolean) => void
  setBrowserRemindersEnabled: (enabled: boolean) => void
  setLiveSyncEnabled: (enabled: boolean) => void
  setNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void | Promise<void>
  setTheme: (theme: 'light' | 'dark') => void
  logBottle: (oz?: number) => void
  saveManualFeed: () => void
  savePastEvent: () => void
  enableBrowserReminders: () => void
  setGotifyReminders: (enabled: boolean) => void | Promise<void>
  setMedicineReminderSettings: (settings: MedicineReminderSettings) => void | Promise<void>
  onCreateBaby?: (input: { name: string; dob?: string }) => Promise<boolean>
  onArchiveBaby?: (babyId: string) => Promise<boolean>
  showToast: (message: string) => void
}
