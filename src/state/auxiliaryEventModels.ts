import { formatDateInput, formatTimeInput, makeId, parseDateAndTime } from '../domain/trackerDomain'
import type { DiaperEvent, DiaperKind, Entry, FeedType, MedicineEvent, MedicineKind, Session } from '../types'

export type ManualDraft = { date: string; time: string; leftMinutes: string; rightMinutes: string; bottleOunces: string; note: string }

export const createBottleEntry = (amount: number, at: number): Entry => ({
  id: makeId(),
  type: 'bottle',
  startedAt: at,
  endedAt: at,
  leftSeconds: 0,
  rightSeconds: 0,
  bottleOunces: amount,
  note: '',
})

export const addBottleToSession = (session: Session, amount: number): Session => ({
  ...session,
  bottleOunces: +(session.bottleOunces + amount).toFixed(1),
})

export const toggleDiaperKind = (selected: DiaperKind[], kind: DiaperKind) =>
  selected.includes(kind) ? selected.filter((item) => item !== kind) : [...selected, kind]

export const createStandaloneDiaper = (kinds: DiaperKind[], at: number): DiaperEvent => ({
  id: makeId(),
  kinds,
  at,
  context: 'standalone',
})

export const createMedicineDose = (kind: MedicineKind, at: number): MedicineEvent => ({ id: makeId(), kind, at })

export const parseManualFeedDraft = (manualDraft: ManualDraft) => {
  const leftSeconds = Math.max(0, Math.round((Number(manualDraft.leftMinutes) || 0) * 60))
  const rightSeconds = Math.max(0, Math.round((Number(manualDraft.rightMinutes) || 0) * 60))
  const bottle = Number(manualDraft.bottleOunces) > 0 ? Number(manualDraft.bottleOunces) : null
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
