import type { Dispatch, SetStateAction } from 'react'
import type { DiaperEvent, DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, EditingTummyTimeState, Entry, MedicineEvent, TummyTimeEvent } from '../../types'

export type TimelineProps = {
  now: number
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  tummyTimes: TummyTimeEvent[]
  editing: EditingState
  editingDiaper: EditingDiaperState
  editingMedicine: EditingMedicineState
  editingTummyTime: EditingTummyTimeState
  openEntryMenuId: string | null
  confirmingDeleteEntryId: string | null
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setEditing: Dispatch<SetStateAction<EditingState>>
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  setEditingMedicine: Dispatch<SetStateAction<EditingMedicineState>>
  setEditingTummyTime: Dispatch<SetStateAction<EditingTummyTimeState>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  resumeEntry: (entry: Entry) => void
  deleteEntry: (entry: Entry) => void
  deleteDiaper: (diaper: DiaperEvent) => void
  deleteMedicine: (medicine: MedicineEvent) => void
  deleteTummyTime: (tummyTime: TummyTimeEvent) => void
  startMedicineEdit: (medicine: MedicineEvent) => void
  startTummyTimeEdit: (tummyTime: TummyTimeEvent) => void
  toggleEditingDiaperKind: (kind: DiaperKind) => void
  toggleEditingEntryDiaperKind: (kind: DiaperKind) => void
  saveDiaperEdit: (diaper: DiaperEvent) => void
  saveMedicineEdit: (medicine: MedicineEvent) => void
  saveTummyTimeEdit: (tummyTime: TummyTimeEvent) => void
  showToast: (message: string) => void
}

export type TimelineItem =
  | { kind: 'feed'; time: number; entry: Entry }
  | { kind: 'diaper'; time: number; diaper: DiaperEvent }
  | { kind: 'medicine'; time: number; medicine: MedicineEvent }
  | { kind: 'tummy'; time: number; tummyTime: TummyTimeEvent }

export type TimelineActions = Pick<
  TimelineProps,
  | 'editing'
  | 'editingDiaper'
  | 'editingMedicine'
  | 'editingTummyTime'
  | 'openEntryMenuId'
  | 'confirmingDeleteEntryId'
  | 'setEntries'
  | 'setEditing'
  | 'setEditingDiaper'
  | 'setEditingMedicine'
  | 'setEditingTummyTime'
  | 'setOpenEntryMenuId'
  | 'setConfirmingDeleteEntryId'
  | 'resumeEntry'
  | 'deleteEntry'
  | 'deleteDiaper'
  | 'deleteMedicine'
  | 'deleteTummyTime'
  | 'startMedicineEdit'
  | 'startTummyTimeEdit'
  | 'toggleEditingDiaperKind'
  | 'toggleEditingEntryDiaperKind'
  | 'saveDiaperEdit'
  | 'saveMedicineEdit'
  | 'saveTummyTimeEdit'
  | 'showToast'
>
