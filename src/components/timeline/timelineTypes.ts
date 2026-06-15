import type { Dispatch, SetStateAction } from 'react'
import type { DiaperEvent, DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, Entry, MedicineEvent } from '../../types'

export type TimelineProps = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  editing: EditingState
  editingDiaper: EditingDiaperState
  editingMedicine: EditingMedicineState
  openEntryMenuId: string | null
  confirmingDeleteEntryId: string | null
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setEditing: Dispatch<SetStateAction<EditingState>>
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  setEditingMedicine: Dispatch<SetStateAction<EditingMedicineState>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  resumeEntry: (entry: Entry) => void
  deleteEntry: (entry: Entry) => void
  deleteDiaper: (diaper: DiaperEvent) => void
  deleteMedicine: (medicine: MedicineEvent) => void
  startMedicineEdit: (medicine: MedicineEvent) => void
  toggleEditingDiaperKind: (kind: DiaperKind) => void
  toggleEditingEntryDiaperKind: (kind: DiaperKind) => void
  saveDiaperEdit: (diaper: DiaperEvent) => void
  saveMedicineEdit: (medicine: MedicineEvent) => void
  showToast: (message: string) => void
}

export type TimelineItem =
  | { kind: 'feed'; time: number; entry: Entry }
  | { kind: 'diaper'; time: number; diaper: DiaperEvent }
  | { kind: 'medicine'; time: number; medicine: MedicineEvent }

export type TimelineActions = Pick<
  TimelineProps,
  | 'editing'
  | 'editingDiaper'
  | 'editingMedicine'
  | 'openEntryMenuId'
  | 'confirmingDeleteEntryId'
  | 'setEntries'
  | 'setEditing'
  | 'setEditingDiaper'
  | 'setEditingMedicine'
  | 'setOpenEntryMenuId'
  | 'setConfirmingDeleteEntryId'
  | 'resumeEntry'
  | 'deleteEntry'
  | 'deleteDiaper'
  | 'deleteMedicine'
  | 'startMedicineEdit'
  | 'toggleEditingDiaperKind'
  | 'toggleEditingEntryDiaperKind'
  | 'saveDiaperEdit'
  | 'saveMedicineEdit'
  | 'showToast'
>
