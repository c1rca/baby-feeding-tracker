import type { Dispatch, SetStateAction } from 'react'
import type { DiaperEvent, DiaperKind, EditingDiaperState, EditingMedicineState, Entry, MedicineEvent, Session, UndoState } from '../types'
import type { ManualDraft } from './auxiliaryEventModels'

export type AuxiliaryEventActionsOptions = {
  now: number
  session: Session | null
  setSession: Dispatch<SetStateAction<Session | null>>
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setDiapers: Dispatch<SetStateAction<DiaperEvent[]>>
  setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>
  selectedDiapers: DiaperKind[]
  setSelectedDiapers: Dispatch<SetStateAction<DiaperKind[]>>
  bottleQuickOz: number
  manualDraft: ManualDraft
  setManualDraft: Dispatch<SetStateAction<ManualDraft>>
  setManualOpen: Dispatch<SetStateAction<boolean>>
  setAdditionalOptionsOpen: Dispatch<SetStateAction<boolean>>
  editingDiaper: EditingDiaperState
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  editingMedicine: EditingMedicineState
  setEditingMedicine: Dispatch<SetStateAction<EditingMedicineState>>
  setDismissedMedicineReminderIds: Dispatch<SetStateAction<string[]>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  undoState: UndoState | null
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  showToast: (message: string) => void
}
