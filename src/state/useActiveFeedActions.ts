import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { calculateActiveSplit, formatClockInput, oppositeSide } from '../domain/trackerDomain'
import type { DiaperKind, Entry, Session, Side, UndoState } from '../types'
import { resolveSelectedStartTime, type StartInputMode } from './activeFeedModels'
import { useActiveSessionCompletion } from './useActiveSessionCompletion'
import { useActiveSessionLifecycle } from './useActiveSessionLifecycle'

type ActiveFeedActionsOptions = {
  now: number
  setNow: Dispatch<SetStateAction<number>>
  session: Session | null
  setSession: Dispatch<SetStateAction<Session | null>>
  setEntries: Dispatch<SetStateAction<Entry[]>>
  selectedDiapers: DiaperKind[]
  setSelectedDiapers: Dispatch<SetStateAction<DiaperKind[]>>
  startOffsetOpen: boolean
  startInputMode: StartInputMode
  startClockText: string
  startMinutesAgo: string
  setStartOffsetOpen: Dispatch<SetStateAction<boolean>>
  setStartInputMode: Dispatch<SetStateAction<StartInputMode>>
  setStartClockText: Dispatch<SetStateAction<string>>
  setStartMinutesAgo: Dispatch<SetStateAction<string>>
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
  setStartOffsetOpen,
  setStartInputMode,
  setStartClockText,
  setStartMinutesAgo,
  suggestedSide,
  undoState,
  setUndoState,
  setToast,
  showToast,
  setBottleOpen,
}: ActiveFeedActionsOptions) {
  const selectedStartTime = useMemo(() => resolveSelectedStartTime({
    now,
    startOffsetOpen,
    startInputMode,
    startClockText,
    startMinutesAgo,
  }), [now, startClockText, startInputMode, startMinutesAgo, startOffsetOpen])

  const activeSplit = useMemo(() => calculateActiveSplit(session, now), [session, now])
  const activeSide = session?.activeSide
  const lifecycle = useActiveSessionLifecycle({
    selectedStartTime,
    startOffsetOpen,
    session,
    setNow,
    setSession,
    resetStartOffset: (currentTime) => {
      setStartOffsetOpen(false)
      setStartInputMode('clock')
      setStartClockText(formatClockInput(currentTime))
      setStartMinutesAgo('0')
    },
  })
  const completion = useActiveSessionCompletion({
    session,
    selectedDiapers,
    setEntries,
    setSelectedDiapers,
    undoState,
    setUndoState,
    setSession,
    setToast,
    showToast,
    setBottleOpen,
  })

  return {
    selectedStartMinutesAgo: Math.max(0, Math.round((now - selectedStartTime) / 60000)),
    activeSplit,
    activeSeconds: activeSplit.left + activeSplit.right,
    activeSide,
    activeOppositeSide: activeSide ? oppositeSide(activeSide) : suggestedSide,
    ...lifecycle,
    ...completion,
  }
}
