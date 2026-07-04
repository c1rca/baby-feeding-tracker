import { useEffect, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import type { DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, EditingTummyTimeState, View } from '../types'
import { formatClockInput, formatDateInput, formatTimeInput } from '../domain/trackerDomain'
import { useServerSync } from '../sync/useServerSync'
import { usePersistentTrackerState } from './usePersistentTrackerState'
import { useNotificationSettings } from '../notifications/useNotificationSettings'
import { useUndoToast } from './useUndoToast'
import { useActiveFeedActions } from './useActiveFeedActions'
import { useAuxiliaryEventActions } from './useAuxiliaryEventActions'
import { useTimelineEntryActions } from './useTimelineEntryActions'
import { useAppUiEffects } from './useAppUiEffects'
import { useBrowserFeedNotifications } from '../notifications/useBrowserFeedNotifications'
import { useTrackerPageModel } from './useTrackerPageModel'
import { useQuickMedicineQuery } from './useQuickMedicineQuery'
import { useTummyTimeActions } from './useTummyTimeActions'
import { shouldShowTummyTimeReminder, tummyTimeReminderCopy } from '../domain/tummyTime'
import type { AppHeader } from '../components/AppHeader'
import type { MedicineReminderBanner } from '../components/MedicineReminderBanner'
import type { TummyTimeReminderBanner } from '../components/TummyTimeReminderBanner'
import type { StatsDashboard } from '../components/StatsDashboard'
import type { TrackerModals } from '../components/TrackerModals'
import type { AppToast } from '../components/AppToast'
import type { TrackView } from '../components/TrackView'

const VIEW_STORAGE_KEY = 'baby-feeding-tracker-view'
const DISMISSED_MEDICINE_REMINDER_STORAGE_KEY = 'baby-feeding-tracker-dismissed-medicine-reminder'
const readInitialView = (): View => {
  if (typeof window === 'undefined') return 'track'
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'stats' ? 'stats' : 'track'
}
const readDismissedMedicineReminderIds = () => {
  if (typeof window === 'undefined') return []
  const stored = window.localStorage.getItem(DISMISSED_MEDICINE_REMINDER_STORAGE_KEY)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return [stored]
  }
}

type AppHeaderProps = ComponentProps<typeof AppHeader>
type MedicineReminderBannerProps = ComponentProps<typeof MedicineReminderBanner>
type TummyTimeReminderBannerProps = ComponentProps<typeof TummyTimeReminderBanner>
type StatsDashboardProps = ComponentProps<typeof StatsDashboard>
type TrackerModalsProps = ComponentProps<typeof TrackerModals>
type AppToastProps = ComponentProps<typeof AppToast>
type TrackViewProps = ComponentProps<typeof TrackView>

export function useTrackerAppController() {
  const { entries, setEntries, session, setSession, diapers, setDiapers, medicines, setMedicines, tummyTimes, setTummyTimes, tummySession, setTummySession, growthMeasurements, setGrowthMeasurements, babyDob, setBabyDob, theme, setTheme, settingsOpen, setSettingsOpen, feedingNotificationsEnabled, setFeedingNotificationsEnabled } = usePersistentTrackerState()
  const [selectedDiapers, setSelectedDiapers] = useState<DiaperKind[]>([])
  const [dismissedMedicineReminderIds, setDismissedMedicineReminderIds] = useState<string[]>(readDismissedMedicineReminderIds)
  const [view, setView] = useState<View>(readInitialView)
  const [bottleOpen, setBottleOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDraft, setManualDraft] = useState(() => {
    const timestamp = new Date().getTime()
    return { date: formatDateInput(timestamp), time: formatTimeInput(timestamp), leftMinutes: '', rightMinutes: '', bottleOunces: '', note: '' }
  })
  const [bottleQuickOz, setBottleQuickOz] = useState(2)
  const [startInputMode, setStartInputMode] = useState<'clock' | 'minutes'>('clock')
  const [startOffsetOpen, setStartOffsetOpen] = useState(false)
  const [startClockText, setStartClockText] = useState(() => formatClockInput(new Date().getTime()))
  const [startMinutesAgo, setStartMinutesAgo] = useState('0')
  const [now, setNow] = useState(() => new Date().getTime())
  const [editing, setEditing] = useState<EditingState>(null)
  const [editingDiaper, setEditingDiaper] = useState<EditingDiaperState>(null)
  const [editingMedicine, setEditingMedicine] = useState<EditingMedicineState>(null)
  const [editingTummyTime, setEditingTummyTime] = useState<EditingTummyTimeState>(null)
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(false)
  const [openEntryMenuId, setOpenEntryMenuId] = useState<string | null>(null)
  const [confirmingDeleteEntryId, setConfirmingDeleteEntryId] = useState<string | null>(null)
  const [resumeFocusTick, setResumeFocusTick] = useState(0)
  const heroRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { syncStatus, hasHydrated } = useServerSync({ entries, diapers, medicines, tummyTimes, tummySession, growthMeasurements, babyDob, session, theme, setEntries, setDiapers, setMedicines, setTummyTimes, setTummySession, setGrowthMeasurements, setBabyDob, setSession, setTheme })
  const { toast, undoState, setToast, setUndoState, showToast, undoToastText, undoLabel, undo } = useUndoToast({ setEntries, setDiapers, setMedicines, setTummyTimes, setSession })

  useAppUiEffects({ setNow, resumeFocusTick, session, heroRef, setBottleOpen, setManualOpen, setSettingsOpen, setSelectedDiapers, setEditingDiaper, openEntryMenuId, setOpenEntryMenuId, setConfirmingDeleteEntryId })

  const { gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, medicineReminderSettingsLoaded, notificationPermission, setGotifyReminders, setMedicineReminderSettings, enableFeedingNotifications } = useNotificationSettings({ setFeedingNotificationsEnabled, showToast })
  const { deleteEntry, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, resumeEntry } = useTimelineEntryActions({ session, setNow, setSession, setEntries, editing, setEditing, editingDiaper, setEditingDiaper, setOpenEntryMenuId, setConfirmingDeleteEntryId, setResumeFocusTick, undoState, setUndoState, setToast, showToast })
  const { availableSelectedDiapers, logBottle, toggleDiaperSelection, logSelectedDiapers, deleteDiaper, saveDiaperEdit, logMedicine, saveMedicineEdit, startMedicineEdit, deleteMedicine, saveManualFeed } = useAuxiliaryEventActions({ now, session, setSession, setEntries, setDiapers, setMedicines, selectedDiapers, setSelectedDiapers, bottleQuickOz, manualDraft, setManualDraft, setManualOpen, setAdditionalOptionsOpen, editingDiaper, setEditingDiaper, editingMedicine, setEditingMedicine, setDismissedMedicineReminderIds, setOpenEntryMenuId, setConfirmingDeleteEntryId, undoState, setUndoState, showToast })
  const { logTummyTimeMinutes, startTummyTime, stopTummyTime, startTummyTimeEdit, saveTummyTimeEdit, deleteTummyTime } = useTummyTimeActions({ tummySession, feedSession: session, setTummySession, setTummyTimes, editingTummyTime, setEditingTummyTime, setAdditionalOptionsOpen, setOpenEntryMenuId, clearUndoTimeout: () => { if (undoState) window.clearTimeout(undoState.timeoutId) }, setUndoState, showToast })

  useQuickMedicineQuery({ hasHydrated, logMedicine })

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view)
  }, [view])

  useEffect(() => {
    if (dismissedMedicineReminderIds.length > 0) {
      window.localStorage.setItem(DISMISSED_MEDICINE_REMINDER_STORAGE_KEY, JSON.stringify(dismissedMedicineReminderIds))
    } else {
      window.localStorage.removeItem(DISMISSED_MEDICINE_REMINDER_STORAGE_KEY)
    }
  }, [dismissedMedicineReminderIds])

  const { today, trend, stats, lastFeed, lastFeedMetaText, avgGapShortText, suggestedSide, nextFeedSideText, nextFeedWindowText, medicineReminder, medicineReminders, showMedicineReminder } = useTrackerPageModel({ entries, diapers, medicines, tummyTimes, session, now, dismissedMedicineReminderIds, medicineReminderSettings: medicineReminderSettingsLoaded ? medicineReminderSettings : null })
  const { selectedStartMinutesAgo, activeSplit, activeSeconds, activeSide, activeOppositeSide, startSession, switchSide, pause, resume, clearSession, endSession } = useActiveFeedActions({ now, setNow, session, setSession, setEntries, selectedDiapers, setSelectedDiapers, startOffsetOpen, startInputMode, startClockText, startMinutesAgo, setStartOffsetOpen, setStartInputMode, setStartClockText, setStartMinutesAgo, suggestedSide, undoState, setUndoState, setToast, showToast, setBottleOpen })

  useBrowserFeedNotifications({ feedingNotificationsEnabled, notificationPermission, lastFeed })

  const headerProps: AppHeaderProps = { view, syncStatus, theme, settingsOpen, setView, setTheme, setSettingsOpen }
  const medicineReminderProps: MedicineReminderBannerProps = { medicineReminder, medicineReminders, showMedicineReminder, dismissMedicineReminder: (id) => setDismissedMedicineReminderIds((prev) => prev.includes(id) ? prev : [...prev, id]), logMedicine }
  const tummyTimeReminder = shouldShowTummyTimeReminder(tummyTimes, tummySession, now) ? { copy: tummyTimeReminderCopy(tummyTimes, now) } : null
  const tummyTimeReminderProps: TummyTimeReminderBannerProps = { reminder: tummyTimeReminder, startTummyTime }
  const statsProps: StatsDashboardProps = { stats, trend, growthMeasurements, setGrowthMeasurements, babyDob }
  const tummyActiveSeconds = tummySession ? Math.max(0, Math.floor((now - tummySession.startedAt) / 1000)) : 0
  const trackViewProps: TrackViewProps = {
    heroRef,
    hero: { session, activeSeconds, activeSplit, activeSide, activeOppositeSide, suggestedSide, nextFeedWindowText, nextFeedSideText, lastFeedMetaText, avgGapShortText, hasLastFeed: Boolean(lastFeed), startOffsetOpen, startInputMode, startClockText, startMinutesAgo, selectedStartMinutesAgo, selectedDiapers, availableSelectedDiapers, additionalOptionsOpen, tummySession, tummyActiveSeconds, setTummySession, setStartOffsetOpen, setStartInputMode, setStartClockText, setStartMinutesAgo, setAdditionalOptionsOpen, setBottleOpen, setManualOpen, setSession, startSession, switchSide, pause, resume, endSession, clearSession, toggleDiaperSelection, logSelectedDiapers, logMedicine, logTummyTimeMinutes, startTummyTime, stopTummyTime },
    overview: { today, trend },
    timeline: { now, entries, diapers, medicines, tummyTimes, editing, editingDiaper, editingMedicine, editingTummyTime, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setEditingTummyTime, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, deleteTummyTime, startMedicineEdit, startTummyTimeEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, saveTummyTimeEdit, showToast },
  }
  const modalsProps: TrackerModalsProps = { bottleOpen, manualOpen, settingsOpen, session, bottleQuickOz, manualDraft, entries, diapers, babyDob, feedingNotificationsEnabled, notificationPermission, gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, fileInputRef, setBottleOpen, setManualOpen, setSettingsOpen, setBottleQuickOz, setManualDraft, setEntries, setDiapers, setBabyDob, setSession, setUndoState, setFeedingNotificationsEnabled, logBottle, saveManualFeed, enableFeedingNotifications, setGotifyReminders, setMedicineReminderSettings, showToast }
  const toastProps: AppToastProps = { toast, undoState, undoToastText, undoLabel, undo }

  return { view, headerProps, medicineReminderProps, tummyTimeReminderProps, trackViewProps, statsProps, modalsProps, toastProps }
}
