import { useMemo } from 'react'
import type { DiaperEvent, Entry, MedicineEvent, MedicineKind, Session, Side } from '../types'
import {
  calculateAvgGapMinutes,
  calculateStats,
  calculateSuggestedSide,
  calculateTodaySummary,
  calculateTrend,
  formatAvgGapShort,
  formatMinutesAgo,
  formatShortTimeRange,
  medicineLabel,
} from '../domain/trackerDomain'

const MEDICINE_REMINDER_MS = 6 * 60 * 60 * 1000
const NEXT_FEED_WINDOW_START_MS = 2 * 60 * 60 * 1000
const NEXT_FEED_WINDOW_END_MS = 3 * 60 * 60 * 1000
const REMINDER_MEDICINE_KINDS: MedicineKind[] = ['tylenol', 'motrin']

export type MedicineReminderModel = {
  id: string
  label: string
  recommendedKind: MedicineKind
  recommendedLabel: string
  at: number
}

type TrackerPageModelOptions = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  session: Session | null
  now: number
  dismissedMedicineReminderId: string | null
}

export function useTrackerPageModel({ entries, diapers, medicines, session, now, dismissedMedicineReminderId }: TrackerPageModelOptions) {
  const today = useMemo(() => calculateTodaySummary(entries, diapers, now), [entries, diapers, now])
  const trend = useMemo(() => calculateTrend(entries, now), [entries, now])
  const stats = useMemo(() => calculateStats(entries, diapers, now, today, trend.days), [entries, diapers, now, today, trend.days])
  const avgGapMinutes = useMemo(() => calculateAvgGapMinutes(entries), [entries])
  const suggestedSide = useMemo<Side>(() => calculateSuggestedSide(entries, today), [entries, today])

  const medicineReminder = useMemo<MedicineReminderModel | null>(() => {
    const medicineReminderDue = REMINDER_MEDICINE_KINDS
      .map((kind) => medicines.find((medicine) => medicine.kind === kind))
      .filter((medicine): medicine is MedicineEvent => Boolean(medicine && now - medicine.at >= MEDICINE_REMINDER_MS))
      .sort((a, b) => a.at - b.at)[0]

    if (!medicineReminderDue) return null
    const label = medicineLabel(medicineReminderDue.kind)
    return {
      id: medicineReminderDue.id,
      label,
      recommendedKind: medicineReminderDue.kind,
      recommendedLabel: label,
      at: medicineReminderDue.at,
    }
  }, [medicines, now])

  const lastFeed = entries[0]
  const activeFeedStartedAt = session?.startedAt ?? null
  const nextFeedStartedAt = activeFeedStartedAt ?? lastFeed?.startedAt ?? null
  const minsSinceLast = lastFeed && now ? Math.floor((now - lastFeed.endedAt) / 60000) : null

  return {
    today,
    trend,
    stats,
    lastFeed,
    lastFeedMetaText: minsSinceLast === null ? 'No feed history yet' : formatMinutesAgo(minsSinceLast),
    avgGapShortText: avgGapMinutes ? formatAvgGapShort(avgGapMinutes) : null,
    suggestedSide,
    nextFeedSideText: suggestedSide[0].toUpperCase(),
    nextFeedWindowText: nextFeedStartedAt
      ? formatShortTimeRange(nextFeedStartedAt + NEXT_FEED_WINDOW_START_MS, nextFeedStartedAt + NEXT_FEED_WINDOW_END_MS)
      : 'After first feed',
    medicineReminder,
    showMedicineReminder: Boolean(medicineReminder && dismissedMedicineReminderId !== medicineReminder.id),
  }
}
