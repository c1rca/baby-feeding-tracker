import type { HourWindow } from '../../../state/notificationPreferences'

type HourRange12hProps = {
  window: HourWindow
  onChange: (window: HourWindow) => void
  label: string
  disabled?: boolean
}

const formatHour12 = (hour24: number): { hour: number; period: 'AM' | 'PM' } => {
  if (hour24 === 0) return { hour: 12, period: 'AM' }
  if (hour24 < 12) return { hour: hour24, period: 'AM' }
  if (hour24 === 12) return { hour: 12, period: 'PM' }
  return { hour: hour24 - 12, period: 'PM' }
}

const to24Hour = (hour12: number, period: 'AM' | 'PM'): number => {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12
  }
  return hour12 === 12 ? 12 : hour12 + 12
}

export function HourRange12h({ window, onChange, label, disabled = false }: HourRange12hProps) {
  const startFormatted = formatHour12(window.startHour)
  const endFormatted = formatHour12(window.endHour)

  const handleStartHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1))
    const hour24 = to24Hour(value, startFormatted.period)
    onChange({ ...window, startHour: hour24 })
  }

  const handleStartMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const startMinute = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0))
    onChange({ ...window, startMinute })
  }

  const handleStartPeriodChange = (period: 'AM' | 'PM') => {
    const hour24 = to24Hour(startFormatted.hour, period)
    onChange({ ...window, startHour: hour24 })
  }

  const handleEndHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1))
    const hour24 = to24Hour(value, endFormatted.period)
    onChange({ ...window, endHour: hour24 })
  }

  const handleEndMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const endMinute = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0))
    onChange({ ...window, endMinute })
  }

  const handleEndPeriodChange = (period: 'AM' | 'PM') => {
    const hour24 = to24Hour(endFormatted.hour, period)
    onChange({ ...window, endHour: hour24 })
  }

  return (
    <div className="notif-hour-range-12h" aria-label={label}>
      {/* Start time */}
      <div className="notif-time-picker">
        <div className="notif-time-input-group">
          <label className="notif-time-label">Start</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={String(startFormatted.hour)} onChange={handleStartHourChange} disabled={disabled} className="notif-hour-input-12h" aria-label={`${label} start hour`} />
          <span className="notif-time-colon">:</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={String(window.startMinute ?? 0).padStart(2, '0')} onChange={handleStartMinuteChange} disabled={disabled} className="notif-minute-input-12h" aria-label={`${label} start minute`} />
        </div>
        <div className="notif-period-selector">
          {(['AM', 'PM'] as const).map((period) => (
            <button
              key={period}
              type="button"
              role="switch"
              aria-checked={startFormatted.period === period}
              aria-label={`Start time ${period}`}
              disabled={disabled}
              className={`notif-period-button${startFormatted.period === period ? ' is-active' : ''}`}
              onClick={() => handleStartPeriodChange(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="notif-time-separator">to</div>

      {/* End time */}
      <div className="notif-time-picker">
        <div className="notif-time-input-group">
          <label className="notif-time-label">End</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={String(endFormatted.hour)} onChange={handleEndHourChange} disabled={disabled} className="notif-hour-input-12h" aria-label={`${label} end hour`} />
          <span className="notif-time-colon">:</span>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={String(window.endMinute ?? 0).padStart(2, '0')} onChange={handleEndMinuteChange} disabled={disabled} className="notif-minute-input-12h" aria-label={`${label} end minute`} />
        </div>
        <div className="notif-period-selector">
          {(['AM', 'PM'] as const).map((period) => (
            <button
              key={period}
              type="button"
              role="switch"
              aria-checked={endFormatted.period === period}
              aria-label={`End time ${period}`}
              disabled={disabled}
              className={`notif-period-button${endFormatted.period === period ? ' is-active' : ''}`}
              onClick={() => handleEndPeriodChange(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <span id={`${label}-desc`} className="sr-only">
        Active hours in 12-hour format. Example: 9:00 AM to 6:00 PM. Use the input fields to enter the hour (1-12) and toggle AM or PM for each time.
      </span>
    </div>
  )
}
