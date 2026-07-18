import type { Entry, MedicineEvent, MedicineKind, PumpEvent, PumpSession } from '../types'
import type { MedicineReminderModel } from './medicineReminderModel'
import { medicineLabel } from '../domain/trackerDomain'
import { startOfLocalDayMs } from '../domain/tummyTime'

// Pure derivations for the CareBrief/overview surface, pulled out of the
// controller so the (previously untested) shaping logic can be unit-tested and
// the God hook stops carrying it inline.

const STAT_ACTIVITY_WINDOW_MS = 72 * 60 * 60 * 1000

export type BriefMedicine = { id?: string; kind: MedicineKind; label: string; at: number }

// The care brief shows medicines still *due* (from the reminder model) and the
// ones already *given* today (kinds with no outstanding reminder). Kept as one
// function so the "due vs given" split can never drift between the two lists.
export function buildBriefMedicineData({ medicineReminders, medicines, now }: { medicineReminders: MedicineReminderModel[]; medicines: MedicineEvent[]; now: number }): { dueMedicines: BriefMedicine[]; givenMedicines: BriefMedicine[] } {
  const dueMedicines = medicineReminders
    .filter((reminder) => reminder.type === 'medicine')
    .map((reminder) => ({ id: reminder.id, kind: reminder.recommendedKind, label: reminder.recommendedLabel, at: reminder.at }))

  const startOfToday = startOfLocalDayMs(now)
  const givenMedicines = (['tylenol', 'motrin'] as const)
    .filter((kind) => !medicineReminders.some((reminder) => reminder.type === 'medicine' && reminder.recommendedKind === kind))
    .flatMap((kind) => {
      const latestToday = medicines.filter((medicine) => medicine.kind === kind && medicine.at >= startOfToday).sort((a, b) => b.at - a.at)[0]
      return latestToday ? [{ kind, label: medicineLabel(kind), at: latestToday.at }] : []
    })

  return { dueMedicines, givenMedicines }
}

// Bottle and pump cards earn their spot only with activity in the last 72h, so an
// exclusively-nursing stretch keeps the overview to what's actually in use.
export function selectStatVisibility({ entries, pumpEvents, pumpSession, now }: { entries: Entry[]; pumpEvents: PumpEvent[]; pumpSession: PumpSession | null; now: number }): { showBottleStat: boolean; showPumpStat: boolean } {
  const cutoff = now - STAT_ACTIVITY_WINDOW_MS
  return {
    showBottleStat: entries.some((entry) => (entry.bottleOunces ?? 0) > 0 && entry.endedAt >= cutoff),
    showPumpStat: Boolean(pumpSession) || pumpEvents.some((event) => event.endedAt >= cutoff),
  }
}

export function summarizePumpingToday({ pumpEvents, now }: { pumpEvents: PumpEvent[]; now: number }): { pumpCountToday: number; pumpedOzToday: number } {
  const pumpsToday = pumpEvents.filter((event) => event.startedAt >= startOfLocalDayMs(now))
  return {
    pumpCountToday: pumpsToday.length,
    pumpedOzToday: pumpsToday.reduce((sum, event) => sum + (event.leftOunces ?? 0) + (event.rightOunces ?? 0), 0),
  }
}
