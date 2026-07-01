import { useMemo } from 'react'
import type { DiaperEvent, Entry, MedicineEvent, Session, Side } from '../types'
import {
  calculateAvgGapMinutes,
  calculateStats,
  calculateSuggestedSide,
  calculateTodaySummary,
  calculateTrend,
  formatAvgGapShort,
  formatMinutesAgo,
  formatShortTimeRange,
  oppositeSide,
} from '../domain/trackerDomain'
import { DEFAULT_MEDICINE_REMINDER_SETTINGS, getMedicineReminders, type MedicineReminderModel, type MedicineReminderSettings } from './medicineReminderModel'

const NEXT_FEED_WINDOW_START_MS = 2 * 60 * 60 * 1000
const NEXT_FEED_WINDOW_END_MS = 3 * 60 * 60 * 1000

type TrackerPageModelOptions = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  session: Session | null
  now: number
  dismissedMedicineReminderIds: string[]
  medicineReminderSettings?: MedicineReminderSettings | null
}

export function useTrackerPageModel({ entries, diapers, medicines, session, now, dismissedMedicineReminderIds, medicineReminderSettings }: TrackerPageModelOptions) {
  const today = useMemo(() => calculateTodaySummary(entries, diapers, now), [entries, diapers, now])
  const trend = useMemo(() => calculateTrend(entries, now), [entries, now])
  const stats = useMemo(() => calculateStats(entries, diapers, medicines, now, today, trend.days), [entries, diapers, medicines, now, today, trend.days])
  const avgGapMinutes = useMemo(() => calculateAvgGapMinutes(entries), [entries])
  const suggestedSide = useMemo<Side>(() => calculateSuggestedSide(entries, today), [entries, today])

  const effectiveMedicineReminderSettings = medicineReminderSettings === undefined ? DEFAULT_MEDICINE_REMINDER_SETTINGS : medicineReminderSettings
  const medicineReminders = useMemo<MedicineReminderModel[]>(() => getMedicineReminders(medicines, now, effectiveMedicineReminderSettings), [medicines, now, effectiveMedicineReminderSettings])
  const visibleMedicineReminders = useMemo(() => medicineReminders.filter((reminder) => !dismissedMedicineReminderIds.includes(reminder.id)), [medicineReminders, dismissedMedicineReminderIds])

  const lastFeed = entries[0]
  const activeFeedStartedAt = session?.startedAt ?? null
  const nextFeedStartedAt = activeFeedStartedAt ?? lastFeed?.startedAt ?? null
  const nextFeedSide = session?.activeSide ? oppositeSide(session.activeSide) : suggestedSide
  const minsSinceLast = lastFeed && now ? Math.floor((now - lastFeed.endedAt) / 60000) : null

  return {
    today,
    trend,
    stats,
    lastFeed,
    lastFeedMetaText: minsSinceLast === null ? 'No feed history yet' : formatMinutesAgo(minsSinceLast),
    avgGapShortText: avgGapMinutes ? formatAvgGapShort(avgGapMinutes) : null,
    suggestedSide,
    nextFeedSideText: nextFeedSide[0].toUpperCase(),
    nextFeedWindowText: nextFeedStartedAt
      ? formatShortTimeRange(nextFeedStartedAt + NEXT_FEED_WINDOW_START_MS, nextFeedStartedAt + NEXT_FEED_WINDOW_END_MS)
      : 'After first feed',
    medicineReminder: visibleMedicineReminders[0] ?? null,
    medicineReminders: visibleMedicineReminders,
    showMedicineReminder: visibleMedicineReminders.length > 0,
  }
}
