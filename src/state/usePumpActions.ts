import type { Dispatch, SetStateAction } from 'react'
import { makeId } from '../domain/trackerDomain'
import { activeElapsedSeconds, activeTimerEventRange } from '../domain/careTimer'
import type { PumpEvent, PumpSession, Session, TummyTimeSession, UndoState } from '../types'
export type { PumpSession } from '../types'

type PumpSide = 'left' | 'both' | 'right'

export type EditingPumpState = { id: string; leftOunces: string; rightOunces: string; note: string } | null

type Options = {
  pumpSession: PumpSession | null
  feedSession: Session | null
  tummySession: TummyTimeSession | null
  setPumpSession: Dispatch<SetStateAction<PumpSession | null>>
  setPumpEvents: Dispatch<SetStateAction<PumpEvent[]>>
  setPumpCompletionOpen: Dispatch<SetStateAction<boolean>>
  editingPump: EditingPumpState
  setEditingPump: Dispatch<SetStateAction<EditingPumpState>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  clearUndoTimeout: () => void
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  showToast: (message: string) => void
}

const sortPumpEvents = (events: PumpEvent[]) => [...events].sort((a, b) => b.startedAt - a.startedAt)
const parseOutput = (value: string) => {
  if (value.trim() === '') return null
  const output = Number(value)
  return Number.isFinite(output) && output >= 0 ? output : null
}

export function usePumpActions({ pumpSession, feedSession, tummySession, setPumpSession, setPumpEvents, setPumpCompletionOpen, editingPump, setEditingPump, setOpenEntryMenuId, clearUndoTimeout, setUndoState, showToast }: Options) {
  const blocked = () => { if (feedSession || tummySession || pumpSession) { showToast('Finish or clear the active timer before starting another session'); return true } return false }
  const startPumping = (side: PumpSide) => { if (blocked()) return; const now = Date.now(); setPumpSession({ id: makeId(), startedAt: now, side, runningStartedAt: now, elapsedSeconds: 0 }) }
  const startManualPumping = () => { if (blocked()) return; const now = Date.now(); setPumpSession({ id: makeId(), startedAt: now, side: 'both', runningStartedAt: now, elapsedSeconds: 0 }); setPumpCompletionOpen(true) }
  const pausePumping = () => setPumpSession((current) => current?.runningStartedAt ? { ...current, elapsedSeconds: activeElapsedSeconds(current, Date.now()), runningStartedAt: null } : current)
  const resumePumping = () => setPumpSession((current) => current && !current.runningStartedAt ? { ...current, runningStartedAt: Date.now() } : current)
  const resumePumpEvent = (pumpEvent: PumpEvent) => {
    if (pumpSession || feedSession || tummySession) return showToast('Finish or clear the active timer before resuming another session')
    const now = Date.now()
    setPumpEvents((current) => current.filter((event) => event.id !== pumpEvent.id))
    setPumpSession({ id: makeId(), startedAt: now, side: 'both', runningStartedAt: now, elapsedSeconds: Math.max(0, Math.round((pumpEvent.endedAt - pumpEvent.startedAt) / 1000)) })
    setOpenEntryMenuId(null)
    showToast('Pumping resumed')
  }
  const stopPumping = () => { if (pumpSession) setPumpCompletionOpen(true) }
  const clearPumping = () => { setPumpSession(null); setPumpCompletionOpen(false) }
  const savePumping = (leftText: string, rightText: string, note: string) => {
    if (!pumpSession) return
    // Record the active (unpaused) duration, mirroring how the tummy/sleep
    // timers persist elapsed time rather than wall-clock span.
    const range = activeTimerEventRange(pumpSession, Date.now())
    const pumpEvent: PumpEvent = { id: pumpSession.id, ...range, leftOunces: parseOutput(leftText), rightOunces: parseOutput(rightText), note: note.trim() || undefined }
    setPumpEvents((prev) => sortPumpEvents([pumpEvent, ...prev]))
    setPumpSession(null)
    setPumpCompletionOpen(false)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ pumpEvent, timeoutId, kind: 'pump-log' })
    showToast('Pumping saved')
  }
  const startPumpEdit = (pumpEvent: PumpEvent) => {
    setEditingPump({ id: pumpEvent.id, leftOunces: pumpEvent.leftOunces?.toString() ?? '', rightOunces: pumpEvent.rightOunces?.toString() ?? '', note: pumpEvent.note ?? '' })
    setOpenEntryMenuId(null)
  }
  const savePumpEdit = (pumpEvent: PumpEvent) => {
    if (!editingPump) return
    setPumpEvents((prev) => sortPumpEvents(prev.map((event) => event.id === pumpEvent.id ? { ...event, leftOunces: parseOutput(editingPump.leftOunces), rightOunces: parseOutput(editingPump.rightOunces), note: editingPump.note.trim() || undefined } : event)))
    setEditingPump(null)
    showToast('Pumping updated')
  }
  const deletePump = (pumpEvent: PumpEvent) => {
    setPumpEvents((prev) => prev.filter((event) => event.id !== pumpEvent.id))
    setEditingPump(null)
    setOpenEntryMenuId(null)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ pumpEvent, timeoutId, kind: 'pump-delete' })
    showToast('Pumping deleted')
  }
  return { startPumping, startManualPumping, pausePumping, resumePumping, resumePumpEvent, stopPumping, clearPumping, savePumping, startPumpEdit, savePumpEdit, deletePump }
}
