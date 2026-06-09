import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { sumSideDurations } from '../domain/feedingUtils'
import { calculateActiveSplit, makeId, oppositeSide, parseClockTimeToday } from '../domain/trackerDomain'
import type { DiaperKind, Entry, FeedType, Session, Side, UndoState } from '../types'

type ActiveFeedActionsOptions = {
  now: number
  setNow: Dispatch<SetStateAction<number>>
  session: Session | null
  setSession: Dispatch<SetStateAction<Session | null>>
  setEntries: Dispatch<SetStateAction<Entry[]>>
  selectedDiapers: DiaperKind[]
  setSelectedDiapers: Dispatch<SetStateAction<DiaperKind[]>>
  startOffsetOpen: boolean
  startInputMode: 'clock' | 'minutes'
  startClockText: string
  startMinutesAgo: string
  suggestedSide: Side
  undoState: UndoState | null
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  setToast: Dispatch<SetStateAction<string>>
  showToast: (message: string) => void
  setBottleOpen: Dispatch<SetStateAction<boolean>>
}

export function useActiveFeedActions({
  now,
  setNow,
  session,
  setSession,
  setEntries,
  selectedDiapers,
  setSelectedDiapers,
  startOffsetOpen,
  startInputMode,
  startClockText,
  startMinutesAgo,
  suggestedSide,
  undoState,
  setUndoState,
  setToast,
  showToast,
  setBottleOpen,
}: ActiveFeedActionsOptions) {
  const selectedStartTime = useMemo(() => {
    const t = now
    if (!startOffsetOpen) return now
    if (startInputMode === 'minutes') {
      const minutes = Math.max(0, Number(startMinutesAgo) || 0)
      return t - Math.round(minutes * 60000)
    }
    return parseClockTimeToday(startClockText, t) ?? t
  }, [now, startClockText, startInputMode, startMinutesAgo, startOffsetOpen])

  const selectedStartMinutesAgo = Math.max(0, Math.round((now - selectedStartTime) / 60000))
  const activeSplit = useMemo(() => calculateActiveSplit(session, now), [session, now])
  const activeSeconds = activeSplit.left + activeSplit.right
  const activeSide = session?.activeSide
  const activeOppositeSide = activeSide ? oppositeSide(activeSide) : suggestedSide

  const startSession = (side: Side) => {
    const t = new Date().getTime()
    const startedAt = Math.min(selectedStartTime, t)
    setNow(t)
    setSession({ startedAt, activeSide: side, segmentStart: startedAt, segments: [], bottleOunces: 0, note: '', diaperKinds: [] })
  }

  const switchSide = (side: Side) => {
    if (!session || !session.activeSide || !session.segmentStart) return
    const t = new Date().getTime()
    setSession({ ...session, segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }], activeSide: side, segmentStart: t })
  }

  const pause = () => {
    if (!session || !session.activeSide || !session.segmentStart) return
    const t = new Date().getTime()
    setSession({ ...session, segments: [...session.segments, { side: session.activeSide, startedAt: session.segmentStart, endedAt: t }], activeSide: null, segmentStart: null })
  }

  const resume = (side: Side) => {
    if (!session) return
    const t = new Date().getTime()
    setNow(t)
    setSession({ ...session, activeSide: side, segmentStart: t })
  }

  const clearSession = () => {
    if (!session) return showToast('No active feed to clear')
    if (undoState) window.clearTimeout(undoState.timeoutId)
    const clearedSession = session
    setSession(null)
    setBottleOpen(false)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ session: clearedSession, timeoutId, kind: 'clear-session' })
    setToast('Active feed cleared')
  }

  const endSession = () => {
    if (!session) return showToast('No active feed to end')
    const t = new Date().getTime()
    const finished = [...session.segments]
    if (session.activeSide && session.segmentStart) finished.push({ side: session.activeSide, startedAt: session.segmentStart, endedAt: t })
    const { left, right } = sumSideDurations(finished)
    const bottle = session.bottleOunces > 0 ? session.bottleOunces : null
    const type: FeedType = bottle && left + right > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
    const selectedKinds = selectedDiapers.filter((kind) => !session.diaperKinds.includes(kind))
    const diaperKinds = [...session.diaperKinds, ...selectedKinds]
    setEntries((prev) => [{ id: makeId(), type, startedAt: session.startedAt, endedAt: t, leftSeconds: left, rightSeconds: right, bottleOunces: bottle, note: session.note.trim() || '', diaperKinds }, ...prev])
    setSelectedDiapers((prev) => prev.filter((kind) => !selectedKinds.includes(kind)))
    setSession(null)
    showToast('Feed saved')
  }

  return {
    selectedStartMinutesAgo,
    activeSplit,
    activeSeconds,
    activeSide,
    activeOppositeSide,
    startSession,
    switchSide,
    pause,
    resume,
    clearSession,
    endSession,
  }
}
