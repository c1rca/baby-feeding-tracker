import type { MedicineEvent, MedicineKind } from '../types'
import { medicineLabel } from '../domain/trackerDomain'

const MEDICINE_REMINDER_MS = 6 * 60 * 60 * 1000
const REMINDER_MEDICINE_KINDS: MedicineKind[] = ['tylenol', 'motrin']

export type MedicineReminderModel = {
  id: string
  label: string
  recommendedKind: MedicineKind
  recommendedLabel: string
  at: number
}

export function getMedicineReminder(medicines: MedicineEvent[], now: number): MedicineReminderModel | null {
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
}
