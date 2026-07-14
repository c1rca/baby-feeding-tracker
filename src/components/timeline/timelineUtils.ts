import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, TummyTimeEvent } from '../../types'
import type { TimelineActions, TimelineItem } from './timelineTypes'

export const MEDICINE_KINDS = ['tylenol', 'motrin', 'vitamin_d'] as const
export const DIAPER_KINDS = ['wet', 'stool'] as const

export function timelineItems(entries: Entry[], diapers: DiaperEvent[], medicines: MedicineEvent[], tummyTimes: TummyTimeEvent[] = [], pumpEvents: PumpEvent[] = []): TimelineItem[] {
  return [
    ...entries.map((entry) => ({ kind: 'feed' as const, time: entry.startedAt, entry })),
    ...diapers.map((diaper) => ({ kind: 'diaper' as const, time: diaper.at, diaper })),
    ...medicines.map((medicine) => ({ kind: 'medicine' as const, time: medicine.at, medicine })),
    ...tummyTimes.map((tummyTime) => ({ kind: 'tummy' as const, time: tummyTime.startedAt, tummyTime })),
    ...pumpEvents.map((pumpEvent) => ({ kind: 'pump' as const, time: pumpEvent.startedAt, pumpEvent })),
  ].sort((a, b) => b.time - a.time)
}

export function formatTimelineAge(time: number, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - time) / 60000))
  if (minutes < 60) return `~${Math.max(1, minutes)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `~${hours}h`
  return `~${Math.floor(hours / 24)}d`
}

export function openMenu(id: string, menuOpen: boolean, actions: TimelineActions) {
  actions.setOpenEntryMenuId(menuOpen ? null : id)
  actions.setConfirmingDeleteEntryId(null)
}
