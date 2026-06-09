import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DiaperEvent, Entry, MedicineEvent, Session, UndoState } from '../types'

type UndoToastOptions = {
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>
  setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>
  setSession: Dispatch<SetStateAction<Session | null>>
}

export function useUndoToast({ setEntries, setDiapers, setMedicines, setSession }: UndoToastOptions) {
  const [toast, setToast] = useState('')
  const [undoState, setUndoState] = useState<UndoState | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  const undoToastText = undoState?.kind === 'resume'
    ? 'Session resumed'
    : undoState?.kind === 'clear-session'
      ? 'Active feed cleared'
      : undoState?.kind === 'diaper-log'
        ? 'Diaper logged'
        : undoState?.kind === 'diaper-delete'
          ? 'Diaper deleted'
          : undoState?.kind === 'medicine-log'
            ? 'Medicine logged'
            : undoState?.kind === 'medicine-delete'
              ? 'Medicine deleted'
              : 'Entry deleted'

  const undoLabel = undoState?.kind === 'resume'
    ? 'Undo resume'
    : undoState?.kind === 'clear-session'
      ? 'Undo clear active feed'
      : undoState?.kind === 'diaper-log'
        ? 'Undo diaper log'
        : undoState?.kind === 'diaper-delete'
          ? 'Undo diaper delete'
          : undoState?.kind === 'medicine-log'
            ? 'Undo medicine log'
            : undoState?.kind === 'medicine-delete'
              ? 'Undo medicine delete'
              : 'Undo delete'

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
    } else if ('entry' in undoState) {
      setEntries((prev) => [undoState.entry, ...prev].sort((a, b) => b.endedAt - a.endedAt))
      if (undoState.kind === 'resume') setSession(undoState.previousSession ?? null)
      showToast(undoState.kind === 'resume' ? 'Resume undone' : 'Deletion undone')
    }
    setUndoState(null)
  }

  return { toast, undoState, setToast, setUndoState, showToast, undoToastText, undoLabel, undo }
}
