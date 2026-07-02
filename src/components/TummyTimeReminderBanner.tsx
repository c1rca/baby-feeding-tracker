import { Dumbbell } from 'lucide-react'

type Props = {
  reminder: { copy: string } | null
  openAdditionalOptions: () => void
}

export function TummyTimeReminderBanner({ reminder, openAdditionalOptions }: Props) {
  if (!reminder) return null
  return (
    <div className="medicine-reminder-stack" aria-label="Tummy Time reminder">
      <div className="medicine-reminder-banner tummy-reminder-banner" role="status">
        <div><strong>Tummy Time reminder</strong><span>{reminder.copy}</span></div>
        <button type="button" className="medicine-reminder-action" aria-label="Start Tummy Time from reminder" onClick={openAdditionalOptions}><Dumbbell size={14} /> Start Tummy Time</button>
      </div>
    </div>
  )
}
