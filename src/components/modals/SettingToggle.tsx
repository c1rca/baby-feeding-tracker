type SettingToggleProps = {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}

// Accessible on/off switch used across the settings panel. The visible label
// lives in the adjacent row text; `label` names the control for assistive tech.
export function SettingToggle({ checked, onChange, label, disabled = false }: SettingToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`settings-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch-thumb" aria-hidden="true" />
    </button>
  )
}
