type ReminderTimingControlProps = {
  value: number
  onChange: (hours: number) => void
  label: string
  presets?: number[]
  zeroLabel?: string
}

const normalizeHours = (value: string) => Math.max(0, Math.min(72, Number(value) || 0))

export function ReminderTimingControl({ value, onChange, label, presets = [2, 4, 6], zeroLabel = 'Off' }: ReminderTimingControlProps) {
  const isCustom = value !== 0 && !presets.includes(value)
  return (
    <div className="reminder-timing-control" aria-label={`${label} reminder timing`}>
      <select aria-label={`${label} reminder interval`} value={isCustom ? 'custom' : String(value)} onChange={(event) => {
        if (event.target.value === 'custom') return onChange(presets.at(-1) ?? 1)
        onChange(Number(event.target.value))
      }}>
        <option value="0">{zeroLabel}</option>
        {presets.map((hours) => <option key={hours} value={hours}>{hours} hours</option>)}
        <option value="custom">Custom…</option>
      </select>
      {isCustom ? <label className="reminder-timing-custom"><span className="sr-only">Custom {label} reminder hours</span><input type="text" inputMode="decimal" pattern="[0-9.]*" value={value} onChange={(event) => onChange(normalizeHours(event.target.value))} aria-label={`Custom ${label} reminder hours`} /><span>hours</span></label> : null}
    </div>
  )
}
