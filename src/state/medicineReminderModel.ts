import type { MedicineEvent, MedicineKind } from '../types'
import { medicineLabel } from '../domain/trackerDomain'

export type MedicineReminderSettings = { tylenol: 0 | 4 | 6; motrin: 0 | 4 | 6 }
export const DEFAULT_MEDICINE_REMINDER_SETTINGS: MedicineReminderSettings = { tylenol: 6, motrin: 6 }

export const normalizeMedicineReminderSettings = (settings?: Partial<Record<keyof MedicineReminderSettings, number>>): MedicineReminderSettings => {
  const intervalFor = (kind: keyof MedicineReminderSettings): 0 | 4 | 6 => {
    const value = Number(settings?.[kind])
    return value === 0 || value === 4 || value === 6 ? value : 6
  }
  return { tylenol: intervalFor('tylenol'), motrin: intervalFor('motrin') }
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const VITAMIN_D_REMINDER_MS = 18 * 60 * 60 * 1000
const REMINDER_MEDICINE_KINDS: (keyof MedicineReminderSettings)[] = ['tylenol', 'motrin']

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

export function getMedicineReminders(medicines: MedicineEvent[], now: number, settings: MedicineReminderSettings | null = DEFAULT_MEDICINE_REMINDER_SETTINGS): MedicineReminderModel[] {
  const vitaminDReminder = (() => {
    const lastVitaminD = latestDoseFor(medicines, 'vitamin_d')
    if (!lastVitaminD) return null
    if (lastVitaminD.at >= startOfLocalDay(now)) return null
    if (now - lastVitaminD.at < VITAMIN_D_REMINDER_MS) return null
    return buildReminder(lastVitaminD, 'vitamin_d', 18)
  })()

  const reminders: MedicineReminderModel[] = vitaminDReminder ? [vitaminDReminder] : []

  const loadedSettings = settings
  if (!loadedSettings) return reminders

  const medicineRemindersDue = REMINDER_MEDICINE_KINDS
    .filter((kind) => loadedSettings[kind] !== 0)
    .map((kind) => {
      const medicine = latestDoseFor(medicines, kind)
      const intervalHours = loadedSettings[kind]
      const reminderMs = intervalHours === 4 ? FOUR_HOURS_MS : SIX_HOURS_MS
      return medicine && now - medicine.at >= reminderMs ? { medicine, intervalHours } : null
    })
    .filter((item): item is { medicine: MedicineEvent; intervalHours: 4 | 6 } => Boolean(item))
    .sort((a, b) => a.medicine.at - b.medicine.at)

  return [
    ...reminders,
    ...medicineRemindersDue.map((item) => buildReminder(item.medicine, 'medicine', item.intervalHours)),
  ]
}

export function getMedicineReminder(medicines: MedicineEvent[], now: number, settings: MedicineReminderSettings | null = DEFAULT_MEDICINE_REMINDER_SETTINGS): MedicineReminderModel | null {
  return getMedicineReminders(medicines, now, settings)[0] ?? null
}
