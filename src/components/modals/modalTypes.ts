import type { RefObject } from 'react'
import type { DiaperEvent, Entry, Session } from '../../types'

export type ManualDraft = { date: string; time: string; leftMinutes: string; rightMinutes: string; bottleOunces: string; note: string }

export type TrackerModalsProps = {
  bottleOpen: boolean
  manualOpen: boolean
  settingsOpen: boolean
  session: Session | null
  bottleQuickOz: number
  manualDraft: ManualDraft
  entries: Entry[]
  diapers: DiaperEvent[]
  babyDob: string
  feedingNotificationsEnabled: boolean
  notificationPermission: NotificationPermission
  gotifyAvailable: boolean
  gotifyRemindersEnabled: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  setBottleOpen: (open: boolean) => void
  setManualOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setBottleQuickOz: (updater: (value: number) => number) => void
  setManualDraft: (draft: ManualDraft) => void
  setEntries: (updater: Entry[] | ((prev: Entry[]) => Entry[])) => void
  setDiapers: (updater: DiaperEvent[] | ((prev: DiaperEvent[]) => DiaperEvent[])) => void
  setBabyDob: (dob: string) => void
  setSession: (session: Session | null) => void
  setUndoState: (state: null) => void
  setFeedingNotificationsEnabled: (enabled: boolean) => void
  logBottle: (oz?: number) => void
  saveManualFeed: () => void
  enableFeedingNotifications: () => void
  setGotifyReminders: (enabled: boolean) => void | Promise<void>
  showToast: (message: string) => void
}
