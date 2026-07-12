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

export type MedicineReminderBannerProps = {
  medicineReminder?: MedicineReminder | null
  medicineReminders?: MedicineReminder[]
  showMedicineReminder: boolean
  dismissMedicineReminder: (id: string) => void
  logMedicine: (kind: MedicineKind) => void
}

export function MedicineReminderBanner({ medicineReminder, medicineReminders, showMedicineReminder, dismissMedicineReminder, logMedicine }: MedicineReminderBannerProps) {
  const reminders = medicineReminders ?? (medicineReminder ? [medicineReminder] : [])
  if (!showMedicineReminder || reminders.length === 0) return null

  return (
    <div className="medicine-reminder-stack" aria-label="Medicine reminders">
      {reminders.map((reminder) => {
        const isVitaminD = reminder.type === 'vitamin_d'
        const title = isVitaminD ? 'Vitamin D reminder' : 'Medicine reminder'
        const copy = isVitaminD
          ? `Take Vitamin D. Last dose was ${reminder.elapsedHours}+ hours ago.`
          : `Take ${reminder.recommendedLabel}. Last dose was ${reminder.label} ${reminder.elapsedHours}+ hours ago.`

        return (
          <div key={reminder.id} className={`medicine-reminder-banner ${isVitaminD ? 'vitamin-reminder-banner' : ''}`} role="alert">
            <div><strong>{title}</strong><span>{copy}</span></div>
            <button type="button" className="medicine-reminder-action" aria-label={`Log ${reminder.recommendedLabel} now`} onClick={() => logMedicine(reminder.recommendedKind)}><Pill size={14} /> Log {reminder.recommendedLabel}</button>
            <button type="button" className="icon-plain" aria-label={`Dismiss ${reminder.recommendedLabel} reminder`} onClick={() => dismissMedicineReminder(reminder.id)}><X size={16} /></button>
          </div>
        )
      })}
    </div>
  )
}
