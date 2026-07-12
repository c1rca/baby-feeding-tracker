import type { Dispatch, SetStateAction } from 'react'
import { makeId } from '../domain/trackerDomain'
import type { PumpEvent, PumpSession, UndoState } from '../types'
export type { PumpSession } from '../types'

type PumpSide = 'left' | 'both' | 'right'

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
  const startPumping = (side: PumpSide) => { const now = Date.now(); setPumpSession({ id: makeId(), startedAt: now, runningStartedAt: now, elapsedSeconds: 0, side }) }
  const startManualPumping = () => { const now = Date.now(); setPumpSession({ id: makeId(), startedAt: now, runningStartedAt: now, elapsedSeconds: 0, side: 'both' }); setPumpCompletionOpen(true) }
  const pausePumping = () => setPumpSession((current) => current?.runningStartedAt ? { ...current, elapsedSeconds: (current.elapsedSeconds ?? 0) + Math.max(0, Math.floor((Date.now() - current.runningStartedAt) / 1000)), runningStartedAt: null } : current)
  const resumePumping = () => setPumpSession((current) => current && !current.runningStartedAt ? { ...current, runningStartedAt: Date.now() } : current)
  const setPumpingSide = (side: PumpSide) => setPumpSession((current) => current ? { ...current, side } : current)
  const stopPumping = () => { if (pumpSession) setPumpCompletionOpen(true) }
  const savePumping = (leftText: string, rightText: string, note: string) => {
    if (!pumpSession) return
    const elapsedSeconds = (pumpSession.elapsedSeconds ?? 0) + (pumpSession.runningStartedAt ? Math.max(0, Math.floor((Date.now() - pumpSession.runningStartedAt) / 1000)) : 0)
    const pumpEvent: PumpEvent = { id: pumpSession.id, startedAt: pumpSession.startedAt, endedAt: pumpSession.startedAt + elapsedSeconds * 1000, leftOunces: parseOutput(leftText), rightOunces: parseOutput(rightText), note: note.trim() || undefined }
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
  return { startPumping, startManualPumping, pausePumping, resumePumping, setPumpingSide, stopPumping, savePumping, startPumpEdit, savePumpEdit, deletePump }
}
