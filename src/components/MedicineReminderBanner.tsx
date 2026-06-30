import { Pill, X } from 'lucide-react'
import type { MedicineKind } from '../types'

export type MedicineReminder = {
  id: string
  label: string
  recommendedKind: MedicineKind
  recommendedLabel: string
  at: number
  type: 'medicine' | 'vitamin_d'
  elapsedHours: number
}

type MedicineReminderBannerProps = {
  medicineReminder: MedicineReminder | null
  showMedicineReminder: boolean
  dismissMedicineReminder: (id: string) => void
  logMedicine: (kind: MedicineKind) => void
}

export function MedicineReminderBanner({ medicineReminder, showMedicineReminder, dismissMedicineReminder, logMedicine }: MedicineReminderBannerProps) {
  if (!showMedicineReminder || !medicineReminder) return null

  const isVitaminD = medicineReminder.type === 'vitamin_d'
  const title = isVitaminD ? 'Vitamin D reminder' : 'Medicine reminder'
  const copy = isVitaminD
    ? `Take Vitamin D. Last dose was ${medicineReminder.elapsedHours}+ hours ago.`
    : `Take ${medicineReminder.recommendedLabel}. Last dose was ${medicineReminder.label} ${medicineReminder.elapsedHours}+ hours ago.`

  return (
    <div className={`medicine-reminder-banner ${isVitaminD ? 'vitamin-reminder-banner' : ''}`} role="alert">
      <div><strong>{title}</strong><span>{copy}</span></div>
      <button type="button" className="medicine-reminder-action" aria-label={`Log ${medicineReminder.recommendedLabel} now`} onClick={() => logMedicine(medicineReminder.recommendedKind)}><Pill size={14} /> Log {medicineReminder.recommendedLabel}</button>
      <button type="button" className="icon-plain" aria-label="Dismiss medicine reminder" onClick={() => dismissMedicineReminder(medicineReminder.id)}><X size={16} /></button>
    </div>
  )
}
