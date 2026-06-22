import { useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import type { DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, View } from '../types'
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
import type { AppHeader } from '../components/AppHeader'
import type { MedicineReminderBanner } from '../components/MedicineReminderBanner'
import type { StatsDashboard } from '../components/StatsDashboard'
import type { TrackerModals } from '../components/TrackerModals'
import type { AppToast } from '../components/AppToast'
import type { TrackView } from '../components/TrackView'

type AppHeaderProps = ComponentProps<typeof AppHeader>
type MedicineReminderBannerProps = ComponentProps<typeof MedicineReminderBanner>
type StatsDashboardProps = ComponentProps<typeof StatsDashboard>
type TrackerModalsProps = ComponentProps<typeof TrackerModals>
type AppToastProps = ComponentProps<typeof AppToast>
type TrackViewProps = ComponentProps<typeof TrackView>

export function useTrackerAppController() {
  const { entries, setEntries, session, setSession, diapers, setDiapers, medicines, setMedicines, growthMeasurements, setGrowthMeasurements, theme, setTheme, settingsOpen, setSettingsOpen, feedingNotificationsEnabled, setFeedingNotificationsEnabled } = usePersistentTrackerState()
  const [selectedDiapers, setSelectedDiapers] = useState<DiaperKind[]>([])
  const [dismissedMedicineReminderId, setDismissedMedicineReminderId] = useState<string | null>(null)
  const [view, setView] = useState<View>('track')
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
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(false)
  const [openEntryMenuId, setOpenEntryMenuId] = useState<string | null>(null)
  const [confirmingDeleteEntryId, setConfirmingDeleteEntryId] = useState<string | null>(null)
  const [resumeFocusTick, setResumeFocusTick] = useState(0)
  const heroRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { syncStatus, hasHydrated } = useServerSync({ entries, diapers, medicines, growthMeasurements, session, theme, setEntries, setDiapers, setMedicines, setGrowthMeasurements, setSession, setTheme })
  const { toast, undoState, setToast, setUndoState, showToast, undoToastText, undoLabel, undo } = useUndoToast({ setEntries, setDiapers, setMedicines, setSession })

  useAppUiEffects({ setNow, resumeFocusTick, session, heroRef, setBottleOpen, setManualOpen, setSettingsOpen, setSelectedDiapers, setEditingDiaper, openEntryMenuId, setOpenEntryMenuId, setConfirmingDeleteEntryId })

  const { gotifyAvailable, gotifyRemindersEnabled, notificationPermission, setGotifyReminders, enableFeedingNotifications } = useNotificationSettings({ setFeedingNotificationsEnabled, showToast })
  const { deleteEntry, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, resumeEntry } = useTimelineEntryActions({ session, setNow, setSession, setEntries, editing, setEditing, editingDiaper, setEditingDiaper, setOpenEntryMenuId, setConfirmingDeleteEntryId, setResumeFocusTick, undoState, setUndoState, setToast, showToast })
  const { availableSelectedDiapers, logBottle, toggleDiaperSelection, logSelectedDiapers, deleteDiaper, saveDiaperEdit, logMedicine, saveMedicineEdit, startMedicineEdit, deleteMedicine, saveManualFeed } = useAuxiliaryEventActions({ now, session, setSession, setEntries, setDiapers, setMedicines, selectedDiapers, setSelectedDiapers, bottleQuickOz, manualDraft, setManualDraft, setManualOpen, setAdditionalOptionsOpen, editingDiaper, setEditingDiaper, editingMedicine, setEditingMedicine, setDismissedMedicineReminderId, setOpenEntryMenuId, setConfirmingDeleteEntryId, undoState, setUndoState, showToast })

  useQuickMedicineQuery({ hasHydrated, logMedicine })

  const { today, trend, stats, lastFeed, lastFeedMetaText, avgGapShortText, suggestedSide, nextFeedSideText, nextFeedWindowText, medicineReminder, showMedicineReminder } = useTrackerPageModel({ entries, diapers, medicines, session, now, dismissedMedicineReminderId })
  const { selectedStartMinutesAgo, activeSplit, activeSeconds, activeSide, activeOppositeSide, startSession, switchSide, pause, resume, clearSession, endSession } = useActiveFeedActions({ now, setNow, session, setSession, setEntries, selectedDiapers, setSelectedDiapers, startOffsetOpen, startInputMode, startClockText, startMinutesAgo, suggestedSide, undoState, setUndoState, setToast, showToast, setBottleOpen })

  useBrowserFeedNotifications({ feedingNotificationsEnabled, notificationPermission, lastFeed })

  const headerProps: AppHeaderProps = { view, syncStatus, theme, settingsOpen, setView, setTheme, setSettingsOpen }
  const medicineReminderProps: MedicineReminderBannerProps = { medicineReminder, showMedicineReminder, dismissMedicineReminder: setDismissedMedicineReminderId, logMedicine }
  const statsProps: StatsDashboardProps = { stats, trend, growthMeasurements, setGrowthMeasurements }
  const trackViewProps: TrackViewProps = {
    heroRef,
    hero: { session, activeSeconds, activeSplit, activeSide, activeOppositeSide, suggestedSide, nextFeedWindowText, nextFeedSideText, lastFeedMetaText, avgGapShortText, hasLastFeed: Boolean(lastFeed), startOffsetOpen, startInputMode, startClockText, startMinutesAgo, selectedStartMinutesAgo, selectedDiapers, availableSelectedDiapers, additionalOptionsOpen, setStartOffsetOpen, setStartInputMode, setStartClockText, setStartMinutesAgo, setAdditionalOptionsOpen, setBottleOpen, setManualOpen, setSession, startSession, switchSide, pause, resume, endSession, clearSession, toggleDiaperSelection, logSelectedDiapers, logMedicine },
    overview: { today, trend },
    timeline: { entries, diapers, medicines, editing, editingDiaper, editingMedicine, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, startMedicineEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, showToast },
  }
  const modalsProps: TrackerModalsProps = { bottleOpen, manualOpen, settingsOpen, session, bottleQuickOz, manualDraft, entries, diapers, feedingNotificationsEnabled, notificationPermission, gotifyAvailable, gotifyRemindersEnabled, fileInputRef, setBottleOpen, setManualOpen, setSettingsOpen, setBottleQuickOz, setManualDraft, setEntries, setDiapers, setSession, setUndoState, setFeedingNotificationsEnabled, logBottle, saveManualFeed, enableFeedingNotifications, setGotifyReminders, showToast }
  const toastProps: AppToastProps = { toast, undoState, undoToastText, undoLabel, undo }

  return { view, headerProps, medicineReminderProps, trackViewProps, statsProps, modalsProps, toastProps }
}
