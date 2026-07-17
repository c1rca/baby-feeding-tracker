import type { Dispatch, SetStateAction } from 'react'
import type { DiaperEvent, DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, EditingTummyTimeState, Entry, MedicineEvent, PumpEvent, TummyTimeEvent } from '../../types'
import type { EditingPumpState } from '../../state/usePumpActions'

export type TimelineProps = {
  now: number
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  tummyTimes: TummyTimeEvent[]
  pumpEvents: PumpEvent[]
  editing: EditingState
  editingDiaper: EditingDiaperState
  editingMedicine: EditingMedicineState
  editingTummyTime: EditingTummyTimeState
  editingPump: EditingPumpState
  openEntryMenuId: string | null
  confirmingDeleteEntryId: string | null
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setEditing: Dispatch<SetStateAction<EditingState>>
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  setEditingMedicine: Dispatch<SetStateAction<EditingMedicineState>>
  setEditingTummyTime: Dispatch<SetStateAction<EditingTummyTimeState>>
  setEditingPump: Dispatch<SetStateAction<EditingPumpState>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  resumeEntry: (entry: Entry) => void
  resumeTummyTime: (tummyTime: TummyTimeEvent) => void
  resumePumpEvent: (pumpEvent: PumpEvent) => void
  deleteEntry: (entry: Entry) => void
  deleteDiaper: (diaper: DiaperEvent) => void
  deleteMedicine: (medicine: MedicineEvent) => void
  deleteTummyTime: (tummyTime: TummyTimeEvent) => void
  deletePump: (pumpEvent: PumpEvent) => void
  startMedicineEdit: (medicine: MedicineEvent) => void
  startTummyTimeEdit: (tummyTime: TummyTimeEvent) => void
  startPumpEdit: (pumpEvent: PumpEvent) => void
  toggleEditingDiaperKind: (kind: DiaperKind) => void
  toggleEditingEntryDiaperKind: (kind: DiaperKind) => void
  saveDiaperEdit: (diaper: DiaperEvent) => void
  saveMedicineEdit: (medicine: MedicineEvent) => void
  saveTummyTimeEdit: (tummyTime: TummyTimeEvent) => void
  savePumpEdit: (pumpEvent: PumpEvent) => void
  onLogPastEvent?: () => void
  showToast: (message: string) => void
}

export type TimelineItem =
  | { kind: 'feed'; time: number; entry: Entry }
  | { kind: 'diaper'; time: number; diaper: DiaperEvent }
  | { kind: 'medicine'; time: number; medicine: MedicineEvent }
  | { kind: 'tummy'; time: number; tummyTime: TummyTimeEvent }
  | { kind: 'pump'; time: number; pumpEvent: PumpEvent }

export type TimelineActions = Pick<
  TimelineProps,
  | 'editing'
  | 'editingDiaper'
  | 'editingMedicine'
  | 'editingTummyTime'
  | 'editingPump'
  | 'openEntryMenuId'
  | 'confirmingDeleteEntryId'
  | 'setEntries'
  | 'setEditing'
  | 'setEditingDiaper'
  | 'setEditingMedicine'
  | 'setEditingTummyTime'
  | 'setEditingPump'
  | 'setOpenEntryMenuId'
  | 'setConfirmingDeleteEntryId'
  | 'resumeEntry'
  | 'resumeTummyTime'
  | 'resumePumpEvent'
  | 'deleteEntry'
  | 'deleteDiaper'
  | 'deleteMedicine'
  | 'deleteTummyTime'
  | 'deletePump'
  | 'startMedicineEdit'
  | 'startTummyTimeEdit'
  | 'startPumpEdit'
  | 'toggleEditingDiaperKind'
  | 'toggleEditingEntryDiaperKind'
  | 'saveDiaperEdit'
  | 'saveMedicineEdit'
  | 'saveTummyTimeEdit'
  | 'savePumpEdit'
  | 'showToast'
>
