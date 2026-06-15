import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DiaperEvent, DiaperKind, EditingDiaperState, EditingMedicineState, Entry, MedicineEvent, Session, UndoState } from '../types'
import type { ManualDraft } from './auxiliaryEventModels'
import { useBottleManualActions } from './useBottleManualActions'
import { useDiaperActions } from './useDiaperActions'
import { useMedicineActions } from './useMedicineActions'

type AuxiliaryEventActionsOptions = {
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
  setDismissedMedicineReminderId: Dispatch<SetStateAction<string | null>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  undoState: UndoState | null
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  showToast: (message: string) => void
}

export function useAuxiliaryEventActions({
  now,
  session,
  setSession,
  setEntries,
  setDiapers,
  setMedicines,
  selectedDiapers,
  setSelectedDiapers,
  bottleQuickOz,
  manualDraft,
  setManualDraft,
  setManualOpen,
  setAdditionalOptionsOpen,
  editingDiaper,
  setEditingDiaper,
  editingMedicine,
  setEditingMedicine,
  setDismissedMedicineReminderId,
  setOpenEntryMenuId,
  setConfirmingDeleteEntryId,
  undoState,
  setUndoState,
  showToast,
}: AuxiliaryEventActionsOptions) {
  const loggedActiveDiaperKinds = useMemo(() => new Set<DiaperKind>(session?.diaperKinds ?? []), [session])
  const clearUndoTimeout = () => {
    if (undoState) window.clearTimeout(undoState.timeoutId)
  }

  const { logBottle, saveManualFeed } = useBottleManualActions({ now, session, setSession, setEntries, bottleQuickOz, manualDraft, setManualDraft, setManualOpen, showToast })
  const { availableSelectedDiapers, toggleDiaperSelection, logSelectedDiapers, deleteDiaper, saveDiaperEdit } = useDiaperActions({
    sessionHasActiveFeed: Boolean(session),
    selectedDiapers,
    setSelectedDiapers,
    editingDiaper,
    setEditingDiaper,
    setDiapers,
    setOpenEntryMenuId,
    setConfirmingDeleteEntryId,
    clearUndoTimeout,
    setUndoState,
    showToast,
  })
  const { logMedicine, saveMedicineEdit, startMedicineEdit, deleteMedicine } = useMedicineActions({
    editingMedicine,
    setEditingMedicine,
    setMedicines,
    setDismissedMedicineReminderId,
    setAdditionalOptionsOpen,
    setOpenEntryMenuId,
    clearUndoTimeout,
    setUndoState,
    showToast,
  })

  return {
    loggedActiveDiaperKinds,
    availableSelectedDiapers,
    logBottle,
    toggleDiaperSelection,
    logSelectedDiapers,
    deleteDiaper,
    saveDiaperEdit,
    logMedicine,
    saveMedicineEdit,
    startMedicineEdit,
    deleteMedicine,
    saveManualFeed,
  }
}
