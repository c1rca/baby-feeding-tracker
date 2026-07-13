import type { HourWindow } from '../../../state/notificationPreferences'

type HourRangeProps = {
  window: HourWindow
  onChange: (window: HourWindow) => void
  label: string
  disabled?: boolean
}

const formatHour = (hour: number): string => {
  return String(hour).padStart(2, '0')
}

export function HourRange({ window, onChange, label, disabled = false }: HourRangeProps) {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0))
    onChange({ ...window, startHour: value })
  }

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0))
    onChange({ ...window, endHour: value })
  }

  const wrapsAtMidnight = window.startHour > window.endHour
  const descId = `${label}-desc`.replace(/\s+/g, '-').toLowerCase()

  return (
    <div className="notif-hour-range" aria-label={label} aria-describedby={descId}>
      <div className="notif-hour-range-input">
        <label>
          <span className="notif-hour-label">Start</span>
          <input
            type="number"
            min="0"
            max="23"
            value={formatHour(window.startHour)}
            onChange={handleStartChange}
            disabled={disabled}
            className="notif-hour-input"
            aria-label={`${label} start hour`}
          />
          <span className="notif-hour-unit">:00</span>
        </label>
      </div>
      <span className="notif-hour-separator">–</span>
      <div className="notif-hour-range-input">
        <label>
          <span className="notif-hour-label">End</span>
          <input
            type="number"
            min="0"
            max="23"
            value={formatHour(window.endHour)}
            onChange={handleEndChange}
            disabled={disabled}
            className="notif-hour-input"
            aria-label={`${label} end hour`}
          />
          <span className="notif-hour-unit">:00</span>
        </label>
      </div>
      <span id={descId} className="sr-only">
        {wrapsAtMidnight
          ? `This time range crosses midnight. Active from ${formatHour(window.startHour)}:00 through the end of the day, then resuming at midnight through ${formatHour(window.endHour)}:00.`
          : `Active from ${formatHour(window.startHour)}:00 to ${formatHour(window.endHour)}:00.`}
      </span>
    </div>
  )
}
