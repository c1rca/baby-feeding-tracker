import type { Dispatch, SetStateAction } from 'react'
import { makeId } from '../domain/trackerDomain'
import { activeElapsedSeconds } from '../domain/careTimer'
import type { PumpEvent, UndoState } from '../types'

type PumpSide = 'left' | 'both' | 'right'
export type PumpSession = { id: string; startedAt: number; side: PumpSide; runningStartedAt?: number | null; elapsedSeconds?: number }
export type EditingPumpState = { id: string; leftOunces: string; rightOunces: string; note: string } | null

type Options = {
  pumpSession: PumpSession | null
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

export function usePumpActions({ pumpSession, setPumpSession, setPumpEvents, setPumpCompletionOpen, editingPump, setEditingPump, setOpenEntryMenuId, clearUndoTimeout, setUndoState, showToast }: Options) {
  const startPumping = (side: PumpSide) => { const now = Date.now(); setPumpSession({ id: makeId(), startedAt: now, side, runningStartedAt: now, elapsedSeconds: 0 }) }
  const startManualPumping = () => { const now = Date.now(); setPumpSession({ id: makeId(), startedAt: now, side: 'both', runningStartedAt: now, elapsedSeconds: 0 }); setPumpCompletionOpen(true) }
  const pausePumping = () => setPumpSession((current) => current?.runningStartedAt ? { ...current, elapsedSeconds: activeElapsedSeconds(current, Date.now()), runningStartedAt: null } : current)
  const resumePumping = () => setPumpSession((current) => current && !current.runningStartedAt ? { ...current, runningStartedAt: Date.now() } : current)
  const stopPumping = () => { if (pumpSession) setPumpCompletionOpen(true) }
  const clearPumping = () => { setPumpSession(null); setPumpCompletionOpen(false) }
  const savePumping = (leftText: string, rightText: string, note: string) => {
    if (!pumpSession) return
    // Record the active (unpaused) duration, mirroring how the tummy/sleep
    // timers persist elapsed time rather than wall-clock span.
    const endedAt = pumpSession.startedAt + activeElapsedSeconds(pumpSession, Date.now()) * 1000
    const pumpEvent: PumpEvent = { id: pumpSession.id, startedAt: pumpSession.startedAt, endedAt, leftOunces: parseOutput(leftText), rightOunces: parseOutput(rightText), note: note.trim() || undefined }
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
  return { startPumping, startManualPumping, pausePumping, resumePumping, stopPumping, clearPumping, savePumping, startPumpEdit, savePumpEdit, deletePump }
}
