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

  return (
    <div className="notif-hour-range" aria-label={label}>
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
    </div>
  )
}
