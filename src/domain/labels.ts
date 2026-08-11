import type { BottleContent, DiaperEvent, DiaperKind, Entry, MedicineEvent, MedicineKind, Side } from '../types'

export const isSide = (value: unknown): value is Side => value === 'left' || value === 'right'
export const sideLabel = (side: Side) => (side === 'left' ? 'Left' : 'Right')
export const oppositeSide = (side: Side): Side => (side === 'left' ? 'right' : 'left')

export const diaperLabel = (kind: DiaperKind) => (kind === 'wet' ? 'Wet' : 'Stool')
export const diaperKinds = (event: DiaperEvent): DiaperKind[] => event.kinds?.length ? event.kinds : event.kind ? [event.kind] : []
export const diaperEventLabel = (event: DiaperEvent) => diaperKinds(event).map(diaperLabel).join(' + ')
export const diaperKindsLabel = (kinds: DiaperKind[]) => kinds.map(diaperLabel).join(' + ')

const MEDICINE_LABELS: Record<MedicineKind, string> = {
  tylenol: 'Tylenol',
  motrin: 'Motrin',
  vitamin_d: 'Vitamin D',
  custom: 'Other',
}

// Medicines with reminder scheduling and dedicated notification preferences.
export const SCHEDULED_MEDICINE_KINDS = ['tylenol', 'motrin', 'vitamin_d'] as const

export const medicineLabel = (kind: MedicineKind) => MEDICINE_LABELS[kind]

// A custom dose is identified by its typed name; everything else by its kind.
export const medicineEventLabel = (medicine: MedicineEvent) =>
  medicine.kind === 'custom' ? (medicine.name?.trim() || 'Other medicine') : MEDICINE_LABELS[medicine.kind]

// The custom names this household has used before, newest first, for reuse.
export const knownCustomMedicineNames = (medicines: MedicineEvent[]) => {
  const seen = new Map<string, number>()
  for (const medicine of medicines) {
    if (medicine.kind !== 'custom') continue
    const name = medicine.name?.trim()
    if (!name) continue
    seen.set(name, Math.max(seen.get(name) ?? 0, medicine.at))
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
}

const BOTTLE_CONTENT_LABELS: Record<BottleContent, string> = {
  breastmilk: 'Breast milk',
  formula: 'Formula',
  mixed: 'Mixed',
}

export const BOTTLE_CONTENTS: BottleContent[] = ['breastmilk', 'formula', 'mixed']
export const bottleContentLabel = (content: BottleContent) => BOTTLE_CONTENT_LABELS[content]
// Older bottles were logged before content was tracked; they stay unlabelled
// rather than being silently reported as breast milk.
export const isBottleContent = (value: unknown): value is BottleContent =>
  typeof value === 'string' && (BOTTLE_CONTENTS as string[]).includes(value)

export const entryDiaperKinds = (entry: Entry): DiaperKind[] => entry.diaperKinds ?? []

export const timelineFeedLabel = (entry: Entry) => {
  if (entry.type !== 'breast') return entry.type
  if (entry.leftSeconds > 0 && entry.rightSeconds === 0) return 'L'
  if (entry.rightSeconds > 0 && entry.leftSeconds === 0) return 'R'
  if (entry.leftSeconds > 0 && entry.rightSeconds > 0) return 'L/R'
  return 'Breast'
}
