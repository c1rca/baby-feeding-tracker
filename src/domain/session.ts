import { sumSideDurations } from './feedingUtils'
import { entryDiaperKinds } from './labels'
import type { DiaperKind, Entry, LegacySession, Segment, Session, Side } from '../types'

export const makeId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `feed-${new Date().getTime()}-${Math.random().toString(36).slice(2, 10)}`)

export const normalizeSession = (raw: LegacySession | Session | null | undefined): Session | null => {
  if (!raw) return null
  return {
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId(),
    bottleOunces: typeof raw.bottleOunces === 'number' ? raw.bottleOunces : 0,
    note: typeof raw.note === 'string' ? raw.note : '',
    diaperKinds: Array.isArray(raw.diaperKinds) ? raw.diaperKinds.filter((kind): kind is DiaperKind => kind === 'wet' || kind === 'stool') : [],
  }
}

export const entryResumeSide = (entry: Entry): Side => {
  if (entry.rightSeconds > 0) return 'right'
  if (entry.leftSeconds > 0) return 'left'
  return 'left'
}

export const entryToResumedSession = (entry: Entry, resumeAt: number): Session => {
  const segments: Segment[] = []
  let cursor = entry.startedAt

  if (entry.leftSeconds > 0) {
    const endedAt = cursor + entry.leftSeconds * 1000
    segments.push({ side: 'left', startedAt: cursor, endedAt })
    cursor = endedAt
  }

  if (entry.rightSeconds > 0) {
    const endedAt = cursor + entry.rightSeconds * 1000
    segments.push({ side: 'right', startedAt: cursor, endedAt })
  }

  return {
    id: makeId(),
    startedAt: entry.startedAt,
    activeSide: entryResumeSide(entry),
    segmentStart: resumeAt,
    segments,
    bottleOunces: entry.bottleOunces ?? 0,
    note: entry.note ?? '',
    diaperKinds: entryDiaperKinds(entry),
  }
}

export const calculateActiveSplit = (session: Session | null, now: number) => {
  if (!session) return { left: 0, right: 0 }
  const draft = [...session.segments]
  if (session.activeSide && session.segmentStart) draft.push({ side: session.activeSide, startedAt: session.segmentStart, endedAt: now })
  return sumSideDurations(draft)
}
