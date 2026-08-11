import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import type { DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, EditingTummyTimeState, View } from '../types'
import { formatClockInput, formatDateInput, formatTimeInput } from '../domain/trackerDomain'
import { useServerSync } from '../sync/useServerSync'
import { persistLiveSyncEnabled, readLiveSyncEnabled } from '../sync/liveSyncSettings'
import { usePersistentTrackerState } from './usePersistentTrackerState'
import { useUnits } from './unitPreferencesContext'
import { useNotificationSettings } from '../notifications/useNotificationSettings'
import { useUndoToast } from './useUndoToast'
import { useCustomTrackerActions } from './useCustomTrackerActions'
import { useActiveFeedActions } from './useActiveFeedActions'
import { useAuxiliaryEventActions } from './useAuxiliaryEventActions'
import { useTimelineEntryActions } from './useTimelineEntryActions'
import { useAppUiEffects } from './useAppUiEffects'
import { useBrowserFeedNotifications } from '../notifications/useBrowserFeedNotifications'
import { useTrackerPageModel } from './useTrackerPageModel'
import { useQuickMedicineQuery } from './useQuickMedicineQuery'
import { useTummyTimeActions } from './useTummyTimeActions'
import { usePumpActions, type EditingPumpState } from './usePumpActions'
import { createDefaultPastEventDraft } from './pastEventModels'
import { usePastEventActions } from './usePastEventActions'
import { buildBriefMedicineData, summarizePumpingToday } from './trackViewData'
import { shouldShowTummyTimeReminder, tummyTimeReminderCopy } from '../domain/tummyTime'
import { dueCustomTrackerReminders } from '../domain/customTrackerReminders'
import { activeElapsedSeconds } from '../domain/careTimer'
import { buildDayRhythm, earliestRhythmDayMs } from '../domain/dayRhythm'
import { buildDiaperWatch, buildWakeWindow } from '../domain/sleepRhythm'
import { collectDiaperSignals } from '../domain/statsUtils'
import type { AppHeader } from '../components/AppHeader'
import type { MedicineReminderBanner } from '../components/MedicineReminderBanner'
import type { TummyTimeReminderBanner } from '../components/TummyTimeReminderBanner'
import type { StatsDashboard } from '../components/StatsDashboard'
import type { TrackerModals } from '../components/TrackerModals'
import type { AppToast } from '../components/AppToast'
import type { TrackView } from '../components/TrackView'

const VIEW_STORAGE_KEY = 'baby-feeding-tracker-view'
const STATS_RANGE_STORAGE_KEY = 'baby-feeding-tracker-stats-range'
export const STATS_RANGE_OPTIONS = [7, 14, 30] as const
const readInitialStatsRange = () => {
  if (typeof window === 'undefined') return 7
  const stored = Number(window.localStorage.getItem(STATS_RANGE_STORAGE_KEY))
  return (STATS_RANGE_OPTIONS as readonly number[]).includes(stored) ? stored : 7
}
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

export function useTrackerAppController({ selectedBabyId = '', babySex = null }: { selectedBabyId?: string | null; babySex?: 'female' | 'male' | null } = {}) {
  const { units } = useUnits()
  const { entries, setEntries, session, setSession, diapers, setDiapers, medicines, setMedicines, tummyTimes, setTummyTimes, pumpEvents, setPumpEvents, pumpSession, setPumpSession, tummySession, setTummySession, tummyGoalMinutes, setTummyGoalMinutes, pumpGoalOunces, setPumpGoalOunces, pumpGoalSessions, setPumpGoalSessions, growthMeasurements, setGrowthMeasurements, healthRecords, setHealthRecords, customTrackers, setCustomTrackers, customEvents, setCustomEvents, babyDob, setBabyDob, theme, setTheme, settingsOpen, setSettingsOpen, feedingNotificationsEnabled, setFeedingNotificationsEnabled, browserRemindersEnabled, setBrowserRemindersEnabled } = usePersistentTrackerState(selectedBabyId)
  const [selectedDiapers, setSelectedDiapers] = useState<DiaperKind[]>([])
  const [dismissedMedicineReminderIds, setDismissedMedicineReminderIds] = useState<string[]>(readDismissedMedicineReminderIds)
  const [view, setView] = useState<View>(readInitialView)
  const [statsRangeDays, setStatsRangeDaysState] = useState<number>(readInitialStatsRange)
  const setStatsRangeDays = (days: number) => {
    setStatsRangeDaysState(days)
    try { window.localStorage.setItem(STATS_RANGE_STORAGE_KEY, String(days)) } catch { /* preference is best-effort */ }
  }
  const [bottleOpen, setBottleOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [pastEventOpen, setPastEventOpen] = useState(false)
  const [pastEventDraft, setPastEventDraft] = useState(() => createDefaultPastEventDraft(Date.now()))
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
  const [pumpCompletionOpen, setPumpCompletionOpen] = useState(false)
  const [editingPump, setEditingPump] = useState<EditingPumpState>(null)
  const [additionalOptionsOpen, setAdditionalOptionsOpen] = useState(false)
  const [openEntryMenuId, setOpenEntryMenuId] = useState<string | null>(null)
  const [confirmingDeleteEntryId, setConfirmingDeleteEntryId] = useState<string | null>(null)
  const [resumeFocusTick, setResumeFocusTick] = useState(0)
  const heroRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [liveSyncEnabled, setLiveSyncEnabledState] = useState(readLiveSyncEnabled)
  const setLiveSyncEnabled = (enabled: boolean) => { setLiveSyncEnabledState(enabled); persistLiveSyncEnabled(enabled) }

  const { syncStatus, hasHydrated, liveConflict, resolveLiveConflict, liveConnected } = useServerSync({ entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, customTrackers, customEvents, babyDob, session, theme, selectedBabyId, liveSyncEnabled, setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, setPumpSession, setTummySession, setTummyGoalMinutes, setPumpGoalOunces, setPumpGoalSessions, setGrowthMeasurements, setHealthRecords, setCustomTrackers, setCustomEvents, setBabyDob, setSession, setTheme })
  const { toast, undoState, setToast, setUndoState, showToast, undoToastText, undoLabel, undo } = useUndoToast({ setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, setCustomEvents, setSession })
  useAppUiEffects({ setNow, resumeFocusTick, session, heroRef, setBottleOpen, setManualOpen, setPastEventOpen, setSettingsOpen, setSelectedDiapers, setEditingDiaper, openEntryMenuId, setOpenEntryMenuId, setConfirmingDeleteEntryId })

  const { gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, notificationPermission, notificationPreferences, setGotifyReminders, setMedicineReminderSettings, setNotificationPreferences, enableBrowserReminders } = useNotificationSettings({ setBrowserRemindersEnabled, showToast })
  const { deleteEntry, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, resumeEntry } = useTimelineEntryActions({ session, setNow, setSession, setEntries, editing, setEditing, editingDiaper, setEditingDiaper, setOpenEntryMenuId, setConfirmingDeleteEntryId, setResumeFocusTick, undoState, setUndoState, setToast, showToast })
  const { availableSelectedDiapers, logBottle, toggleDiaperSelection, logSelectedDiapers, logDiaperKinds, deleteDiaper, saveDiaperEdit, logMedicine, saveMedicineEdit, startMedicineEdit, deleteMedicine, saveManualFeed } = useAuxiliaryEventActions({ now, session, setSession, setEntries, setDiapers, setMedicines, selectedDiapers, setSelectedDiapers, bottleQuickOz, manualDraft, setManualDraft, setManualOpen, setAdditionalOptionsOpen, editingDiaper, setEditingDiaper, editingMedicine, setEditingMedicine, setDismissedMedicineReminderIds, setOpenEntryMenuId, setConfirmingDeleteEntryId, undoState, setUndoState, showToast })
  const { logTummyTimeMinutes, startTummyTime, pauseCareTimer, resumeCareTimer, resumeTummyTime, stopTummyTime, startSleep, stopSleep, startTummyTimeEdit, saveTummyTimeEdit, deleteTummyTime } = useTummyTimeActions({ tummySession, feedSession: session, pumpSession, setTummySession, setTummyTimes, customTrackers, setCustomEvents, editingTummyTime, setEditingTummyTime, setAdditionalOptionsOpen, setOpenEntryMenuId, clearUndoTimeout: () => { if (undoState) window.clearTimeout(undoState.timeoutId) }, setUndoState, showToast })
  const pumpActions = usePumpActions({ pumpSession, feedSession: session, tummySession, setPumpSession, setPumpEvents, setPumpCompletionOpen, editingPump, setEditingPump, setOpenEntryMenuId, clearUndoTimeout: () => { if (undoState) window.clearTimeout(undoState.timeoutId) }, setUndoState, showToast, volumeUnit: units.volume })
  const { logCustomEvent, startCustomTimer, deleteCustomEvent } = useCustomTrackerActions({ customTrackers, setCustomEvents, setOpenEntryMenuId, tummySession, setTummySession, feedSession: session, pumpSession, clearUndoTimeout: () => { if (undoState) window.clearTimeout(undoState.timeoutId) }, setUndoState, showToast })
  const { savePastEvent } = usePastEventActions({ now, draft: pastEventDraft, setDraft: setPastEventDraft, setOpen: setPastEventOpen, setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, showToast, volumeUnit: units.volume })

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

  const { today, trend, stats, lastFeed, lastFeedMetaText, avgGapShortText, suggestedSide, nextFeedSideText, nextFeedWindowText, nextFeedWindow, medicineReminder, medicineReminders, showMedicineReminder } = useTrackerPageModel({ entries, diapers, medicines, tummyTimes, pumpEvents, tummyGoalMinutes, session, now, dismissedMedicineReminderIds, medicineReminderSettings, statsRangeDays })
  const { selectedStartMinutesAgo, activeSplit, activeSeconds, activeSide, activeOppositeSide, startSession, switchSide, pause, resume, clearSession, endSession } = useActiveFeedActions({ now, setNow, session, setSession, setEntries, selectedDiapers, setSelectedDiapers, startOffsetOpen, startInputMode, startClockText, startMinutesAgo, setStartOffsetOpen, setStartInputMode, setStartClockText, setStartMinutesAgo, suggestedSide, undoState, setUndoState, setToast, showToast, setBottleOpen })

  const headerProps: AppHeaderProps = { view, syncStatus, settingsOpen, setView, setSettingsOpen }
  const medicineReminderProps: MedicineReminderBannerProps = { medicineReminder, medicineReminders, showMedicineReminder: hasHydrated && showMedicineReminder, dismissMedicineReminder: (id) => setDismissedMedicineReminderIds((prev) => prev.includes(id) ? prev : [...prev, id]), logMedicine }
  const tummyTimeReminder = hasHydrated && shouldShowTummyTimeReminder(tummyTimes, tummySession, now, tummyGoalMinutes, notificationPreferences?.tummyActiveHours) ? { copy: tummyTimeReminderCopy(tummyTimes, now, tummyGoalMinutes) } : null

  const customTrackerReminders = useMemo(
    () => (hasHydrated ? dueCustomTrackerReminders({ trackers: customTrackers, events: customEvents, now, preferences: notificationPreferences }) : []),
    [hasHydrated, customTrackers, customEvents, now, notificationPreferences],
  )
  useBrowserFeedNotifications({ browserRemindersEnabled, notificationPermission, preferences: notificationPreferences, now, lastFeed, medicineReminders, tummyTimeReminder, customTrackerReminders })
  const tummyTimeReminderProps: TummyTimeReminderBannerProps & { customTrackerReminders: typeof customTrackerReminders } = { reminder: tummyTimeReminder, startTummyTime, customTrackerReminders }
  const statsProps: StatsDashboardProps = { stats, trend, growthMeasurements, setGrowthMeasurements, babyDob, babySex, healthRecords, setHealthRecords, customTrackers, customEvents, now, statsRangeDays, setStatsRangeDays, statsRangeOptions: STATS_RANGE_OPTIONS }
  const { pumpCountToday, pumpedOzToday } = summarizePumpingToday({ pumpEvents, now })
  const briefMedicineData = buildBriefMedicineData({ medicineReminders, medicines, now })
  const wakeWindow = buildWakeWindow(tummyTimes, tummySession, babyDob, now)
  const diaperWatch = buildDiaperWatch(collectDiaperSignals(diapers, entries).filter((signal) => signal.kind === 'wet'), now)
  const tummyActiveSeconds = tummySession ? activeElapsedSeconds(tummySession, now) : 0
  const pumpActiveSeconds = pumpSession ? activeElapsedSeconds(pumpSession, now) : 0
  // Medicines and the tummy goal only feed the day recap, so they ride along as
  // extras rather than widening the rhythm's positional signature.
  const rhythmExtras = { medicines, tummyGoalMinutes, customTrackers, customEvents }

  const trackViewProps: TrackViewProps = {
    heroRef,
    hero: { session, activeSeconds, activeSplit, activeSide, activeOppositeSide, suggestedSide, nextFeedWindowText, nextFeedSideText, lastFeedMetaText, avgGapShortText, hasLastFeed: Boolean(lastFeed), startOffsetOpen, startInputMode, startClockText, startMinutesAgo, selectedStartMinutesAgo, selectedDiapers, availableSelectedDiapers, additionalOptionsOpen, tummySession, tummyActiveSeconds, setTummySession, setStartOffsetOpen, setStartInputMode, setStartClockText, setStartMinutesAgo, setAdditionalOptionsOpen, setBottleOpen, setManualOpen, setPastEventOpen, setSession, startSession, switchSide, pause, resume, endSession, clearSession, toggleDiaperSelection, logSelectedDiapers, logDiaperKinds, logMedicine, medicines, customTrackers, startCustomTimer, logTummyTimeMinutes, startTummyTime, pauseTummyTime: pauseCareTimer, resumeTummyTime: resumeCareTimer, stopTummyTime, startSleep, stopSleep, pumpSession, pumpActiveSeconds, startPumping: pumpActions.startPumping, startManualPumping: pumpActions.startManualPumping, pausePumping: pumpActions.pausePumping, resumePumping: pumpActions.resumePumping, stopPumping: pumpActions.stopPumping, clearPumping: pumpActions.clearPumping, savePumping: pumpActions.savePumping, pumpCompletionOpen, setPumpCompletionOpen },
    brief: {
      now,
      hasHydrated,
      nextFeedWindow,
      vitaminDTakenToday: stats.vitaminDTakenToday,
      latestVitaminDAt: stats.latestVitaminD?.at ?? null,
      dueMedicines: briefMedicineData.dueMedicines,
      givenMedicines: briefMedicineData.givenMedicines,
      tummyMinutesToday: stats.tummyMinutesToday,
      tummyGoalMinutes: stats.tummyDailyGoalMinutes,
      pumpGoalOunces,
      pumpGoalSessions,
      pumpedOzToday,
      pumpCountToday,
      customTrackers,
      customEvents,
      runningTrackerId: tummySession?.kind === 'custom' ? tummySession.trackerId ?? null : null,
      logCustomEvent,
      // `startCustomTimer` reaches the needs card through the hero props, which
      // TrackView spreads alongside these.
      stopCustomTimer: stopTummyTime,
    },
    // Bottle and Pumped-today cards are legacy and intentionally hidden from the
    // main page; keep the props (false) so TrackOverview still supports them.
    overview: { today, pumpedOzToday, pumpCountToday, showBottleStat: false, showPumpStat: false, rhythm: buildDayRhythm(entries, diapers, tummyTimes, now, now, rhythmExtras), rhythmForDay: (dayAnchorMs: number) => buildDayRhythm(entries, diapers, tummyTimes, now, dayAnchorMs, rhythmExtras), earliestDayMs: earliestRhythmDayMs(entries, diapers, tummyTimes) },
    signals: { hasHydrated, wakeWindow, diaperWatch, startSleep, logDiaperKinds },
    timeline: { now, entries, diapers, medicines, tummyTimes, pumpEvents, customTrackers, customEvents, editing, editingDiaper, editingMedicine, editingTummyTime, editingPump, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setEditingTummyTime, setEditingPump, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, resumeTummyTime, resumePumpEvent: pumpActions.resumePumpEvent, deleteEntry, deleteDiaper, deleteMedicine, deleteTummyTime, deletePump: pumpActions.deletePump, deleteCustomEvent, startMedicineEdit, startTummyTimeEdit, startPumpEdit: pumpActions.startPumpEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, saveTummyTimeEdit, savePumpEdit: pumpActions.savePumpEdit, showToast },
  }
  const modalsProps: TrackerModalsProps = { customTrackers, customEvents, setCustomTrackers, setCustomEvents, bottleOpen, manualOpen, pastEventOpen, settingsOpen, session, bottleQuickOz, manualDraft, pastEventDraft, entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, babyDob, tummyGoalMinutes, feedingNotificationsEnabled, browserRemindersEnabled, liveSyncEnabled, notificationPermission, notificationPreferences, gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, theme, fileInputRef, setBottleOpen, setManualOpen, setPastEventOpen, setSettingsOpen, setBottleQuickOz, setManualDraft, setPastEventDraft, setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, setPumpSession, setTummySession, setPumpGoalOunces, setPumpGoalSessions, setGrowthMeasurements, setHealthRecords, setBabyDob, setTummyGoalMinutes, setSession, setUndoState, setFeedingNotificationsEnabled, setBrowserRemindersEnabled, setLiveSyncEnabled, setNotificationPreferences, setTheme, logBottle, saveManualFeed, savePastEvent, enableBrowserReminders, setGotifyReminders, setMedicineReminderSettings, showToast }
  const toastProps: AppToastProps = { toast, undoState, undoToastText, undoLabel, undo }
  const liveSyncProps = { conflict: liveConflict, onResolve: resolveLiveConflict, connected: liveConnected }

  return { view, headerProps, medicineReminderProps, tummyTimeReminderProps, trackViewProps, statsProps, modalsProps, toastProps, liveSyncProps }
}
