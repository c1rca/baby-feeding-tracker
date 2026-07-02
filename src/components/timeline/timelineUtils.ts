import type { DiaperEvent, Entry, MedicineEvent, TummyTimeEvent } from '../../types'
import type { TimelineActions, TimelineItem } from './timelineTypes'

export const MEDICINE_KINDS = ['tylenol', 'motrin', 'vitamin_d'] as const
export const DIAPER_KINDS = ['wet', 'stool'] as const

export function timelineItems(entries: Entry[], diapers: DiaperEvent[], medicines: MedicineEvent[], tummyTimes: TummyTimeEvent[] = []): TimelineItem[] {
  return [
    ...entries.map((entry) => ({ kind: 'feed' as const, time: entry.startedAt, entry })),
    ...diapers.map((diaper) => ({ kind: 'diaper' as const, time: diaper.at, diaper })),
    ...medicines.map((medicine) => ({ kind: 'medicine' as const, time: medicine.at, medicine })),
    ...tummyTimes.map((tummyTime) => ({ kind: 'tummy' as const, time: tummyTime.startedAt, tummyTime })),
  ].sort((a, b) => b.time - a.time)
}

export function openMenu(id: string, menuOpen: boolean, actions: TimelineActions) {
  actions.setOpenEntryMenuId(menuOpen ? null : id)
  actions.setConfirmingDeleteEntryId(null)
}
