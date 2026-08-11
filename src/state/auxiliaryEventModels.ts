import { formatDateInput, formatTimeInput, makeId, parseDateAndTime } from '../domain/trackerDomain'
import { displayVolumeToOz, type VolumeUnit } from '../domain/units'
import type { BottleContent, CustomEvent, CustomTracker, DiaperEvent, DiaperKind, Entry, FeedType, MedicineEvent, MedicineKind, Session } from '../types'

export type ManualDraft = { date: string; time: string; leftMinutes: string; rightMinutes: string; bottleOunces: string; bottleContent?: BottleContent; note: string }

export const createBottleEntry = (amount: number, at: number, content?: BottleContent): Entry => ({
  id: makeId(),
  type: 'bottle',
  startedAt: at,
  endedAt: at,
  leftSeconds: 0,
  rightSeconds: 0,
  bottleOunces: amount,
  bottleContent: content,
  note: '',
})

// Topping up an active feed keeps the first content recorded: a second pour is
// the same bottle unless the caregiver explicitly picked something else.
export const addBottleToSession = (session: Session, amount: number, content?: BottleContent): Session => ({
  ...session,
  bottleOunces: +(session.bottleOunces + amount).toFixed(1),
  bottleContent: session.bottleContent ?? content,
})

export const toggleDiaperKind = (selected: DiaperKind[], kind: DiaperKind) =>
  selected.includes(kind) ? selected.filter((item) => item !== kind) : [...selected, kind]

export const createStandaloneDiaper = (kinds: DiaperKind[], at: number): DiaperEvent => ({
  id: makeId(),
  kinds,
  at,
  context: 'standalone',
})

export const createMedicineDose = (kind: MedicineKind, at: number, name?: string): MedicineEvent =>
  ({ id: makeId(), kind, at, name: kind === 'custom' ? name?.trim() || undefined : undefined })

/**
 * A log against a caregiver-defined tracker.
 *
 * The goal in force at the time is stamped onto the event, so that tightening a
 * goal tomorrow cannot retroactively unmake a day that was met under the old one.
 */
export const createCustomEvent = (tracker: CustomTracker, at: number, durationSeconds?: number): CustomEvent => ({
  id: makeId(),
  trackerId: tracker.id,
  at,
  goalAtLog: tracker.goal,
  ...(durationSeconds === undefined ? {} : { durationSeconds }),
})

// `bottleOunces` in the draft is whatever unit the caregiver typed; it becomes
// canonical ounces here.
export const parseManualFeedDraft = (manualDraft: ManualDraft, volumeUnit: VolumeUnit = 'oz') => {
  const leftSeconds = Math.max(0, Math.round((Number(manualDraft.leftMinutes) || 0) * 60))
  const rightSeconds = Math.max(0, Math.round((Number(manualDraft.rightMinutes) || 0) * 60))
  const bottle = Number(manualDraft.bottleOunces) > 0 ? displayVolumeToOz(Number(manualDraft.bottleOunces), volumeUnit) : null
  const startedAt = parseDateAndTime(manualDraft.date, manualDraft.time)
  const hasFeedData = leftSeconds + rightSeconds > 0 || Boolean(bottle)
  if (!hasFeedData) return { ok: false as const, reason: 'empty' as const }
  if (startedAt === null) return { ok: false as const, reason: 'invalid-date' as const }

  const durationMs = Math.max(0, leftSeconds + rightSeconds) * 1000
  const type: FeedType = bottle && leftSeconds + rightSeconds > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
  return {
    ok: true as const,
    entry: {
      id: makeId(),
      type,
      startedAt,
      endedAt: startedAt + durationMs,
      leftSeconds,
      rightSeconds,
      bottleOunces: bottle,
      bottleContent: bottle ? manualDraft.bottleContent : undefined,
      note: manualDraft.note.trim(),
    } satisfies Entry,
  }
}

export const createDefaultManualDraft = (timestamp: number): ManualDraft => ({
  date: formatDateInput(timestamp),
  time: formatTimeInput(timestamp),
  leftMinutes: '',
  rightMinutes: '',
  bottleOunces: '',
  note: '',
})
