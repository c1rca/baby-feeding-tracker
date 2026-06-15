import type { Dispatch, SetStateAction } from 'react'
import type { EditingDiaperState, EditingState, Entry, Session, UndoState } from '../types'

export type TimelineEntryActionsOptions = {
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

export type TimelineUndoHelpers = {
  clearUndoTimeout: () => void
}
