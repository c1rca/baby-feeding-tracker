import { Pill, X } from 'lucide-react'
import type { MedicineKind } from '../types'

export type MedicineReminder = {
  id: string
  label: string
  recommendedKind: MedicineKind
  recommendedLabel: string
  at: number
}

type MedicineReminderBannerProps = {
  medicineReminder: MedicineReminder | null
  showMedicineReminder: boolean
  dismissMedicineReminder: (id: string) => void
  logMedicine: (kind: MedicineKind) => void
}

export function MedicineReminderBanner({ medicineReminder, showMedicineReminder, dismissMedicineReminder, logMedicine }: MedicineReminderBannerProps) {
  if (!showMedicineReminder || !medicineReminder) return null

  return (
    <div className="medicine-reminder-banner" role="alert">
      <div><strong>Medicine reminder</strong><span>Take {medicineReminder.recommendedLabel}. Last dose was {medicineReminder.label} 6+ hours ago.</span></div>
      <button type="button" className="medicine-reminder-action" aria-label={`Log ${medicineReminder.recommendedLabel} now`} onClick={() => logMedicine(medicineReminder.recommendedKind)}><Pill size={14} /> Log {medicineReminder.recommendedLabel}</button>
      <button type="button" className="icon-plain" aria-label="Dismiss medicine reminder" onClick={() => dismissMedicineReminder(medicineReminder.id)}><X size={16} /></button>
    </div>
  )
}
