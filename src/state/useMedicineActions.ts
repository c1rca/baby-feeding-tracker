import type { Dispatch, SetStateAction } from 'react'
import { formatClockInput, formatDateInput, parseClockTimeOnDate, parseDateAndTime } from '../domain/trackerDomain'
import { medicineEventLabel } from '../domain/labels'
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
  const logMedicine = (kind: MedicineKind, name?: string) => {
    const medicine = createMedicineDose(kind, new Date().getTime(), name)
    setMedicines((prev) => [medicine, ...prev].sort((a, b) => b.at - a.at))
    setDismissedMedicineReminderIds([])
    setAdditionalOptionsOpen(false)
    clearUndoTimeout()
    const timeoutId = window.setTimeout(() => setUndoState(null), 5000)
    setUndoState({ medicine, timeoutId, kind: 'medicine-log' })
    showToast(`${medicineEventLabel(medicine)} logged`)
  }

  const saveMedicineEdit = (medicine: MedicineEvent) => {
    if (!editingMedicine) return
    const dayStart = parseDateAndTime(editingMedicine.date ?? formatDateInput(editingMedicine.originalAt), '00:00')
    const nextAt = dayStart === null ? null : parseClockTimeOnDate(editingMedicine.time, dayStart)
    if (nextAt === null) return showToast('Enter a valid medicine time')
    setMedicines((prev) => prev.map((item) => item.id === medicine.id ? { ...item, kind: editingMedicine.kind, at: nextAt } : item).sort((a, b) => b.at - a.at))
    setDismissedMedicineReminderIds([])
    setEditingMedicine(null)
    showToast('Medicine updated')
  }

  const startMedicineEdit = (medicine: MedicineEvent) => {
    setEditingMedicine({ id: medicine.id, date: formatDateInput(medicine.at), kind: medicine.kind, time: formatClockInput(medicine.at), originalAt: medicine.at })
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
