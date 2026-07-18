import { createMedicineDose, createStandaloneDiaper, parseManualFeedDraft } from './auxiliaryEventModels'
import { formatDateInput, formatTimeInput, makeId, parseDateAndTime } from '../domain/trackerDomain'
import type { DiaperKind, MedicineKind, PumpEvent, TummyTimeEvent } from '../types'

export type PastEventKind = 'feed' | 'diaper' | 'medicine' | 'tummy' | 'sleep' | 'pump'
export type PastEventDraft = ReturnType<typeof createDefaultPastEventDraft>
export const createDefaultPastEventDraft = (at: number) => ({ kind: 'feed' as PastEventKind, date: formatDateInput(at), time: formatTimeInput(at), leftMinutes: '', rightMinutes: '', bottleOunces: '', diaperKinds: [] as DiaperKind[], medicineKind: 'vitamin_d' as MedicineKind, durationMinutes: '', pumpLeftOunces: '', pumpRightOunces: '', note: '' })

const minutes = (value: string) => { const amount = Number(value); return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0 }
const output = (value: string) => value.trim() === '' ? null : (Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null)
export function parsePastEventDraft(draft: PastEventDraft, now: number) {
  const at = parseDateAndTime(draft.date, draft.time)
  if (at === null) return { ok: false as const, reason: 'invalid-date' as const }
  if (at > now) return { ok: false as const, reason: 'future-date' as const }
  if (draft.kind === 'feed') { const feed = parseManualFeedDraft(draft); return feed.ok ? { ok: true as const, event: { kind: 'feed' as const, event: feed.entry } } : feed }
  if (draft.kind === 'diaper') return draft.diaperKinds.length ? { ok: true as const, event: { kind: 'diaper' as const, event: createStandaloneDiaper(draft.diaperKinds, at) } } : { ok: false as const, reason: 'empty' as const }
  if (draft.kind === 'medicine') return { ok: true as const, event: { kind: 'medicine' as const, event: createMedicineDose(draft.medicineKind, at) } }
  const duration = minutes(draft.durationMinutes)
  if (!duration) return { ok: false as const, reason: 'empty' as const }
  const endedAt = at + duration * 60_000
  // A completed past event must finish at or before now; a duration that pushes
  // the end into the future would create a nap/pump span that extends past the
  // present, corrupting the day rhythm and stats.
  if (endedAt > now) return { ok: false as const, reason: 'future-date' as const }
  if (draft.kind === 'tummy' || draft.kind === 'sleep') { const event: TummyTimeEvent = { id: makeId(), startedAt: at, endedAt, note: draft.note.trim(), kind: draft.kind }; return { ok: true as const, event: { kind: draft.kind, event } } }
  const leftOunces = output(draft.pumpLeftOunces), rightOunces = output(draft.pumpRightOunces)
  if (leftOunces === null && draft.pumpLeftOunces.trim() || rightOunces === null && draft.pumpRightOunces.trim()) return { ok: false as const, reason: 'invalid-output' as const }
  const event: PumpEvent = { id: makeId(), startedAt: at, endedAt, leftOunces, rightOunces, note: draft.note.trim() || undefined }
  return { ok: true as const, event: { kind: 'pump' as const, event } }
}
