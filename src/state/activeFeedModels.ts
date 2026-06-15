import { sumSideDurations } from '../domain/feedingUtils'
import { makeId, parseClockTimeToday } from '../domain/trackerDomain'
import type { DiaperKind, Entry, FeedType, Session, Side } from '../types'

export type StartInputMode = 'clock' | 'minutes'

export function resolveSelectedStartTime({
  now,
  startOffsetOpen,
  startInputMode,
  startClockText,
  startMinutesAgo,
}: {
  now: number
  startOffsetOpen: boolean
  startInputMode: StartInputMode
  startClockText: string
  startMinutesAgo: string
}) {
  if (!startOffsetOpen) return now
  if (startInputMode === 'minutes') {
    const minutes = Math.max(0, Number(startMinutesAgo) || 0)
    return now - Math.round(minutes * 60000)
  }
  return parseClockTimeToday(startClockText, now) ?? now
}

export function buildStartedSession(side: Side, selectedStartTime: number, currentTime: number): Session {
  const startedAt = Math.min(selectedStartTime, currentTime)
  return { id: makeId(), startedAt, activeSide: side, segmentStart: startedAt, segments: [], bottleOunces: 0, note: '', diaperKinds: [] }
}

export function appendActiveSegment(session: Session, endedAt: number) {
  if (!session.activeSide || !session.segmentStart) return session.segments
  return [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt }]
}

export function switchActiveSide(session: Session, side: Side, currentTime: number): Session {
  return { ...session, segments: appendActiveSegment(session, currentTime), activeSide: side, segmentStart: currentTime }
}

export function pauseActiveSession(session: Session, currentTime: number): Session {
  return { ...session, segments: appendActiveSegment(session, currentTime), activeSide: null, segmentStart: null }
}

export function resumeActiveSession(session: Session, side: Side, currentTime: number): Session {
  return { ...session, activeSide: side, segmentStart: currentTime }
}

export function buildFinishedEntry(session: Session, endedAt: number, selectedDiapers: DiaperKind[]): { entry: Entry; selectedKinds: DiaperKind[] } {
  const finished = appendActiveSegment(session, endedAt)
  const { left, right } = sumSideDurations(finished)
  const bottle = session.bottleOunces > 0 ? session.bottleOunces : null
  const type: FeedType = bottle && left + right > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
  const selectedKinds = selectedDiapers.filter((kind) => !session.diaperKinds.includes(kind))
  const diaperKinds = [...session.diaperKinds, ...selectedKinds]

  return {
    entry: {
      id: makeId(),
      sourceSessionId: session.id,
      type,
      startedAt: session.startedAt,
      endedAt,
      leftSeconds: left,
      rightSeconds: right,
      bottleOunces: bottle,
      note: session.note.trim() || '',
      diaperKinds,
    },
    selectedKinds,
  }
}
