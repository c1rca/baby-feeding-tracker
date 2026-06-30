import type { MedicineEvent, MedicineKind } from '../types'
import { medicineLabel } from '../domain/trackerDomain'

const MEDICINE_REMINDER_MS = 6 * 60 * 60 * 1000
const VITAMIN_D_REMINDER_MS = 18 * 60 * 60 * 1000
const REMINDER_MEDICINE_KINDS: MedicineKind[] = ['tylenol', 'motrin']

export type MedicineReminderModel = {
  id: string
  label: string
  recommendedKind: MedicineKind
  recommendedLabel: string
  at: number
  type: 'medicine' | 'vitamin_d'
  elapsedHours: number
}

const startOfLocalDay = (timestamp: number) => {
  const day = new Date(timestamp)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

const latestDoseFor = (medicines: MedicineEvent[], kind: MedicineKind) => (
  medicines
    .filter((medicine) => medicine.kind === kind)
    .sort((a, b) => b.at - a.at)[0]
)

const buildReminder = (medicine: MedicineEvent, type: MedicineReminderModel['type'], elapsedHours: number): MedicineReminderModel => {
  const label = medicineLabel(medicine.kind)
  return {
    id: medicine.id,
    label,
    recommendedKind: medicine.kind,
    recommendedLabel: label,
    at: medicine.at,
    type,
    elapsedHours,
  }
}

export function getMedicineReminder(medicines: MedicineEvent[], now: number): MedicineReminderModel | null {
  const vitaminDReminder = (() => {
    const lastVitaminD = latestDoseFor(medicines, 'vitamin_d')
    if (!lastVitaminD) return null
    if (lastVitaminD.at >= startOfLocalDay(now)) return null
    if (now - lastVitaminD.at < VITAMIN_D_REMINDER_MS) return null
    return buildReminder(lastVitaminD, 'vitamin_d', 18)
  })()

  if (vitaminDReminder) return vitaminDReminder

  const medicineReminderDue = REMINDER_MEDICINE_KINDS
    .map((kind) => latestDoseFor(medicines, kind))
    .filter((medicine): medicine is MedicineEvent => Boolean(medicine && now - medicine.at >= MEDICINE_REMINDER_MS))
    .sort((a, b) => a.at - b.at)[0]

  if (!medicineReminderDue) return null
  return buildReminder(medicineReminderDue, 'medicine', 6)
}
