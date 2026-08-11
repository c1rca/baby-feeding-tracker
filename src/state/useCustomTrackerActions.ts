import type { Dispatch, SetStateAction } from 'react'
import { makeId } from '../domain/trackerDomain'
import { createCustomEvent } from './auxiliaryEventModels'
import type { CustomEvent, CustomTracker, PumpSession, Session, TummyTimeSession, UndoState } from '../types'

type CustomTrackerActionsOptions = {
  customTrackers: CustomTracker[]
  setCustomEvents: Dispatch<SetStateAction<CustomEvent[]>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  tummySession: TummyTimeSession | null
  setTummySession: Dispatch<SetStateAction<TummyTimeSession | null>>
  feedSession: Session | null
  pumpSession: PumpSession | null
  clearUndoTimeout: () => void
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  showToast: (message: string) => void
}

export function useCustomTrackerActions({ customTrackers, setCustomEvents, setOpenEntryMenuId, tummySession, setTummySession, feedSession, pumpSession, clearUndoTimeout, setUndoState, showToast }: CustomTrackerActionsOptions) {
  const logCustomEvent = (trackerId: string, at = Date.now()) => {
    const tracker = customTrackers.find((item) => item.id === trackerId)
    if (!tracker) return
    const event = createCustomEvent(tracker, at)
    setCustomEvents((prev) => [event, ...prev].sort((a, b) => b.at - a.at))
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ customEvent: event, timeoutId, kind: 'custom-log' })
    showToast(`${tracker.name} logged`)
  }

  /**
   * A caregiver-defined timer runs in the same single slot as tummy time and
   * sleep, which is what keeps the one-timer-at-a-time rule true across all of
   * them — including after a reload, since that slot is persisted and synced.
   */
  const startCustomTimer = (trackerId: string) => {
    const tracker = customTrackers.find((item) => item.id === trackerId)
    if (!tracker) return
    if (feedSession || pumpSession) {
      showToast(`Finish or clear the active timer before starting ${tracker.name}`)
      return
    }
    if (tummySession) return
    const now = Date.now()
    setTummySession({ id: makeId(), startedAt: now, runningStartedAt: now, elapsedSeconds: 0, note: '', kind: 'custom', trackerId })
    showToast(`${tracker.name} started`)
  }

  const deleteCustomEvent = (customEvent: CustomEvent) => {
    setCustomEvents((prev) => prev.filter((event) => event.id !== customEvent.id))
    setOpenEntryMenuId(null)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ customEvent, timeoutId, kind: 'custom-delete' })
    showToast('Log deleted')
  }

  return { logCustomEvent, startCustomTimer, deleteCustomEvent }
}
