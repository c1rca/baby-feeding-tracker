import type { Dispatch, SetStateAction } from 'react'
import { makeId } from '../domain/trackerDomain'
import type { PumpEvent, UndoState } from '../types'

type PumpSide = 'left' | 'both' | 'right'
export type PumpSession = { id: string; startedAt: number; side: PumpSide }
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
  const startPumping = (side: PumpSide) => setPumpSession({ id: makeId(), startedAt: Date.now(), side })
  const stopPumping = () => { if (pumpSession) setPumpCompletionOpen(true) }
  const savePumping = (leftText: string, rightText: string, note: string) => {
    if (!pumpSession) return
    const pumpEvent: PumpEvent = { id: pumpSession.id, startedAt: pumpSession.startedAt, endedAt: Date.now(), leftOunces: parseOutput(leftText), rightOunces: parseOutput(rightText), note: note.trim() || undefined }
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
  return { startPumping, stopPumping, savePumping, startPumpEdit, savePumpEdit, deletePump }
}
