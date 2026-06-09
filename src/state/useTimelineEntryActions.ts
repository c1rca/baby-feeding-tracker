import type { Dispatch, SetStateAction } from 'react'
import { entryToResumedSession } from '../domain/trackerDomain'
import type { DiaperKind, EditingDiaperState, EditingState, Entry, Session, UndoState } from '../types'

type TimelineEntryActionsOptions = {
  session: Session | null
  setNow: Dispatch<SetStateAction<number>>
  setSession: Dispatch<SetStateAction<Session | null>>
  setEntries: Dispatch<SetStateAction<Entry[]>>
  editing: EditingState
  setEditing: Dispatch<SetStateAction<EditingState>>
  editingDiaper: EditingDiaperState
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  setResumeFocusTick: Dispatch<SetStateAction<number>>
  undoState: UndoState | null
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  setToast: Dispatch<SetStateAction<string>>
  showToast: (message: string) => void
}

export function useTimelineEntryActions({
  session,
  setNow,
  setSession,
  setEntries,
  editing,
  setEditing,
  editingDiaper,
  setEditingDiaper,
  setOpenEntryMenuId,
  setConfirmingDeleteEntryId,
  setResumeFocusTick,
  undoState,
  setUndoState,
  setToast,
  showToast,
}: TimelineEntryActionsOptions) {
  const clearUndoTimeout = () => {
    if (undoState) window.clearTimeout(undoState.timeoutId)
  }

  const deleteEntry = (entry: Entry) => {
    clearUndoTimeout()
    setOpenEntryMenuId(null)
    setConfirmingDeleteEntryId(null)
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ entry, timeoutId, kind: 'delete' })
    setToast('Entry deleted')
  }

  const toggleEditingDiaperKind = (kind: DiaperKind) => {
    if (!editingDiaper) return
    const kinds = editingDiaper.kinds.includes(kind) ? editingDiaper.kinds.filter((item) => item !== kind) : [...editingDiaper.kinds, kind]
    setEditingDiaper({ ...editingDiaper, kinds })
  }

  const toggleEditingEntryDiaperKind = (kind: DiaperKind) => {
    if (!editing) return
    const diaperKinds = editing.diaperKinds.includes(kind) ? editing.diaperKinds.filter((item) => item !== kind) : [...editing.diaperKinds, kind]
    setEditing({ ...editing, diaperKinds })
  }

  const resumeEntry = (entry: Entry) => {
    if (session) return showToast('Finish or clear the active feed before resuming another entry')
    clearUndoTimeout()
    const previousSession = session
    const t = new Date().getTime()
    setNow(t)
    setEntries((prev) => prev.filter((x) => x.id !== entry.id))
    setSession(entryToResumedSession(entry, t))
    setResumeFocusTick((tick) => tick + 1)
    setEditing(null)
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ entry, timeoutId, kind: 'resume', previousSession })
    setToast('Session resumed')
  }

  return {
    deleteEntry,
    toggleEditingDiaperKind,
    toggleEditingEntryDiaperKind,
    resumeEntry,
  }
}
