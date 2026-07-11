import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DiaperEvent, Entry, MedicineEvent, PumpEvent, Session, TummyTimeEvent, UndoState } from '../types'
import { undoLabelFor, undoToastTextFor } from './undoToastLabels'

type UndoToastOptions = {
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>
  setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>
  setTummyTimes: Dispatch<SetStateAction<TummyTimeEvent[]>>
  setPumpEvents: Dispatch<SetStateAction<PumpEvent[]>>
  setSession: Dispatch<SetStateAction<Session | null>>
}

export function useUndoToast({ setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, setSession }: UndoToastOptions) {
  const [toast, setToast] = useState('')
  const [undoState, setUndoState] = useState<UndoState | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  const undoToastText = undoToastTextFor(undoState)
  const undoLabel = undoLabelFor(undoState)

  const undo = () => {
    if (!undoState) return
    window.clearTimeout(undoState.timeoutId)
    if (undoState.kind === 'clear-session') {
      setSession(undoState.session)
      showToast('Active feed restored')
    } else if (undoState.kind === 'diaper-log') {
      setDiapers((prev) => prev.filter((diaper) => diaper.id !== undoState.diaper.id))
      showToast('Diaper log undone')
    } else if (undoState.kind === 'diaper-delete') {
      setDiapers((prev) => [undoState.diaper, ...prev].sort((a, b) => b.at - a.at))
      showToast('Diaper delete undone')
    } else if (undoState.kind === 'medicine-log') {
      setMedicines((prev) => prev.filter((medicine) => medicine.id !== undoState.medicine.id))
      showToast('Medicine log undone')
    } else if (undoState.kind === 'medicine-delete') {
      setMedicines((prev) => [undoState.medicine, ...prev].sort((a, b) => b.at - a.at))
      showToast('Medicine delete undone')
    } else if (undoState.kind === 'tummy-log') {
      setTummyTimes((prev) => prev.filter((event) => event.id !== undoState.tummyTime.id))
      showToast('Tummy Time log undone')
    } else if (undoState.kind === 'tummy-delete') {
      setTummyTimes((prev) => [undoState.tummyTime, ...prev].sort((a, b) => b.startedAt - a.startedAt))
      showToast('Tummy Time delete undone')
    } else if (undoState.kind === 'pump-log') {
      setPumpEvents((prev) => prev.filter((event) => event.id !== undoState.pumpEvent.id))
      showToast('Pumping log undone')
    } else if (undoState.kind === 'pump-delete') {
      setPumpEvents((prev) => [undoState.pumpEvent, ...prev].sort((a, b) => b.startedAt - a.startedAt))
      showToast('Pumping delete undone')
    } else if ('entry' in undoState) {
      setEntries((prev) => [undoState.entry, ...prev].sort((a, b) => b.endedAt - a.endedAt))
      if (undoState.kind === 'resume') setSession(undoState.previousSession ?? null)
      showToast(undoState.kind === 'resume' ? 'Resume undone' : 'Deletion undone')
    }
    setUndoState(null)
  }

  return { toast, undoState, setToast, setUndoState, showToast, undoToastText, undoLabel, undo }
}
