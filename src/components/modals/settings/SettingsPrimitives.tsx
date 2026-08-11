import { useState, type ReactNode } from 'react'
import { AlertTriangle, Check, type LucideIcon } from 'lucide-react'

/**
 * The shared vocabulary of the settings panel.
 *
 * Before this existed each tab invented its own: two competing form idioms
 * (stacked `.settings-form` labels versus label-left/control-right rows), two
 * list-row shapes, feedback messages floating outside their cards, and headings
 * that some tabs had and others did not. Everything here exists so that a row
 * in Household is built out of the same parts as a row in Data.
 */

export function SettingsSection({ label, lead, action, children }: {
  label?: string
  lead?: ReactNode
  /** Optional trailing element on the heading line — a count, a status pill. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="settings-group" aria-label={label}>
      {label ? (
        <div className="settings-section-head">
          <p className="settings-group-label">{label}</p>
          {action}
        </div>
      ) : null}
      {lead ? <p className="settings-lead">{lead}</p> : null}
      {children}
    </section>
  )
}

/**
 * The canonical row: an optional icon, a title, a hint, and a control. `stacked` drops the control onto its own line for wide controls;
 * every row stacks anyway below 560px, where side-by-side stops fitting.
 */
export function SettingsRow({ icon: Icon, title, hint, control, children, stacked = false, tone }: {
  icon?: LucideIcon
  title: ReactNode
  hint?: ReactNode
  control?: ReactNode
  children?: ReactNode
  stacked?: boolean
  tone?: 'danger'
}) {
  return (
    <div className={`settings-row${stacked ? ' is-stacked' : ''}${tone ? ` is-${tone}` : ''}`}>
      <div className="settings-row-main">
        {Icon ? <span className="settings-row-icon" aria-hidden="true"><Icon size={17} /></span> : null}
        <span className="settings-row-text">
          <strong>{title}</strong>
          {hint ? <small>{hint}</small> : null}
        </span>
        {control ? <div className="settings-row-control">{control}</div> : null}
      </div>
      {children ? <div className="settings-row-extra">{children}</div> : null}
    </div>
  )
}

/** A labelled field, for the places that genuinely need a stacked form. */
export function SettingsField({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="settings-field">
      <span className="settings-field-label">{label}{hint ? <small>{hint}</small> : null}</span>
      {children}
    </label>
  )
}

export function InlineMessage({ kind, children }: { kind: 'success' | 'error' | 'info'; children: ReactNode }) {
  return (
    <p className={`settings-message is-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'error' ? <AlertTriangle size={14} aria-hidden="true" /> : kind === 'success' ? <Check size={14} aria-hidden="true" /> : null}
      <span>{children}</span>
    </p>
  )
}

export function SettingsBadge({ children, tone }: { children: ReactNode; tone?: 'owner' | 'pending' | 'muted' }) {
  return <span className={`settings-badge${tone ? ` is-${tone}` : ''}`}>{children}</span>
}

/**
 * Two-step destructive action, the pattern Household already used and every
 * other tab should: the first press arms it, the second carries it out, and it
 * disarms itself if you look away. A `window.confirm` cannot say what it is
 * about to do in the app's own words, so it is not used for anything here.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, ariaLabel, icon: Icon, disabled = false }: {
  label: ReactNode
  confirmLabel: ReactNode
  onConfirm: () => void
  ariaLabel: string
  icon?: LucideIcon
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      className={`danger settings-confirm${armed ? ' is-armed' : ''}`}
      disabled={disabled}
      aria-label={armed ? `Confirm: ${ariaLabel}` : ariaLabel}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {Icon ? <Icon size={15} /> : null} {armed ? confirmLabel : label}
    </button>
  )
}

export function SettingsEmpty({ icon: Icon, title, body, action }: {
  icon: LucideIcon
  title: string
  body?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="settings-card settings-empty">
      <span className="settings-empty-icon" aria-hidden="true"><Icon size={20} /></span>
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  )
}
