import type { DiaperEvent, DiaperKind, Entry, MedicineKind, Side } from '../types'

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
}

export const medicineLabel = (kind: MedicineKind) => MEDICINE_LABELS[kind]

export const entryDiaperKinds = (entry: Entry): DiaperKind[] => entry.diaperKinds ?? []

export const timelineFeedLabel = (entry: Entry) => {
  if (entry.type !== 'breast') return entry.type
  if (entry.leftSeconds > 0 && entry.rightSeconds === 0) return 'L'
  if (entry.rightSeconds > 0 && entry.leftSeconds === 0) return 'R'
  if (entry.leftSeconds > 0 && entry.rightSeconds > 0) return 'L/R'
  return 'Breast'
}
