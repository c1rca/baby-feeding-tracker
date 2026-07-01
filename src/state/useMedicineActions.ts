import type { Dispatch, SetStateAction } from 'react'
import { formatClockInput, medicineLabel, parseClockTimeToday } from '../domain/trackerDomain'
import type { EditingMedicineState, MedicineEvent, MedicineKind, UndoState } from '../types'
import { createMedicineDose } from './auxiliaryEventModels'

type MedicineActionsOptions = {
  editingMedicine: EditingMedicineState
  setEditingMedicine: Dispatch<SetStateAction<EditingMedicineState>>
  setMedicines: Dispatch<SetStateAction<MedicineEvent[]>>
  setDismissedMedicineReminderIds: Dispatch<SetStateAction<string[]>>
  setAdditionalOptionsOpen: Dispatch<SetStateAction<boolean>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  clearUndoTimeout: () => void
  setUndoState: Dispatch<SetStateAction<UndoState | null>>
  showToast: (message: string) => void
}

export function useMedicineActions({ editingMedicine, setEditingMedicine, setMedicines, setDismissedMedicineReminderIds, setAdditionalOptionsOpen, setOpenEntryMenuId, clearUndoTimeout, setUndoState, showToast }: MedicineActionsOptions) {
  const logMedicine = (kind: MedicineKind) => {
    const medicine = createMedicineDose(kind, new Date().getTime())
    setMedicines((prev) => [medicine, ...prev].sort((a, b) => b.at - a.at))
    setDismissedMedicineReminderIds([])
    setAdditionalOptionsOpen(false)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ medicine, timeoutId, kind: 'medicine-log' })
    showToast(`${medicineLabel(kind)} logged`)
  }

  const saveMedicineEdit = (medicine: MedicineEvent) => {
    if (!editingMedicine) return
    const nextAt = parseClockTimeToday(editingMedicine.time, editingMedicine.originalAt)
    if (nextAt === null) return showToast('Enter a valid medicine time')
    setMedicines((prev) => prev.map((item) => item.id === medicine.id ? { ...item, kind: editingMedicine.kind, at: nextAt } : item).sort((a, b) => b.at - a.at))
    setDismissedMedicineReminderIds([])
    setEditingMedicine(null)
    showToast('Medicine updated')
  }

  const startMedicineEdit = (medicine: MedicineEvent) => {
    setEditingMedicine({ id: medicine.id, kind: medicine.kind, time: formatClockInput(medicine.at), originalAt: medicine.at })
    setOpenEntryMenuId(null)
  }

  const deleteMedicine = (medicine: MedicineEvent) => {
    setMedicines((prev) => prev.filter((item) => item.id !== medicine.id))
    setEditingMedicine(null)
    setOpenEntryMenuId(null)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ medicine, timeoutId, kind: 'medicine-delete' })
    showToast('Medicine deleted')
  }

  return { logMedicine, saveMedicineEdit, startMedicineEdit, deleteMedicine }
}
