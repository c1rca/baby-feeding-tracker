import type { CustomEvent, DiaperEvent, Entry, MedicineEvent, PumpEvent, TummyTimeEvent } from '../../types'
import type { TimelineActions, TimelineItem } from './timelineTypes'
import { bottleContentLabel, diaperKinds, diaperKindsLabel, entryDiaperKinds, medicineEventLabel, timelineFeedLabel } from '../../domain/labels'

export const MEDICINE_KINDS = ['tylenol', 'motrin', 'vitamin_d'] as const
// Free-text search across everything a caregiver could plausibly remember
// typing: notes, plus the human labels for each event's kind.
export function timelineItemSearchText(item: TimelineItem, trackerNames: Map<string, string> = new Map()) {
  if (item.kind === 'feed') {
    return [item.entry.note, timelineFeedLabel(item.entry), item.entry.type, item.entry.bottleContent ? bottleContentLabel(item.entry.bottleContent) : '', diaperKindsLabel(entryDiaperKinds(item.entry))]
      .filter(Boolean).join(' ').toLowerCase()
  }
  if (item.kind === 'diaper') return `diaper ${diaperKindsLabel(diaperKinds(item.diaper))}`.toLowerCase()
  if (item.kind === 'medicine') return `medicine ${medicineEventLabel(item.medicine)}`.toLowerCase()
  if (item.kind === 'tummy') return `${item.tummyTime.kind === 'sleep' ? 'sleep nap' : 'tummy time'} ${item.tummyTime.note ?? ''}`.toLowerCase()
  // The tracker's name lives on the definition, not the event, so searching by
  // it — the only name a caregiver knows these by — needs the lookup.
  if (item.kind === 'custom') return `${trackerNames.get(item.customEvent.trackerId) ?? ''} ${item.customEvent.note ?? ''}`.toLowerCase()
  return `pumping ${item.pumpEvent.note ?? ''}`.toLowerCase()
}

export const DIAPER_KINDS = ['wet', 'stool'] as const

export function timelineItems(entries: Entry[], diapers: DiaperEvent[], medicines: MedicineEvent[], tummyTimes: TummyTimeEvent[] = [], pumpEvents: PumpEvent[] = [], customEvents: CustomEvent[] = []): TimelineItem[] {
  return [
    ...entries.map((entry) => ({ kind: 'feed' as const, time: entry.startedAt, entry })),
    ...diapers.map((diaper) => ({ kind: 'diaper' as const, time: diaper.at, diaper })),
    ...medicines.map((medicine) => ({ kind: 'medicine' as const, time: medicine.at, medicine })),
    ...tummyTimes.map((tummyTime) => ({ kind: 'tummy' as const, time: tummyTime.startedAt, tummyTime })),
    ...pumpEvents.map((pumpEvent) => ({ kind: 'pump' as const, time: pumpEvent.startedAt, pumpEvent })),
    ...customEvents.map((customEvent) => ({ kind: 'custom' as const, time: customEvent.at, customEvent })),
  ].sort((a, b) => b.time - a.time)
}

export function formatTimelineAge(time: number, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - time) / 60000))
  if (minutes < 60) return `about ${Math.max(1, minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `about ${hours}h ago`
  return `about ${Math.floor(hours / 24)}d ago`
}

export function openMenu(id: string, menuOpen: boolean, actions: TimelineActions) {
  actions.setOpenEntryMenuId(menuOpen ? null : id)
  actions.setConfirmingDeleteEntryId(null)
}
