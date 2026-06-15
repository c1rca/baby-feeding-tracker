import { diaperLabel } from '../../domain/trackerDomain'
import type { DiaperKind } from '../../types'
import type { HeroPanelProps } from './HeroPanel.types'

type DiaperQuickLogProps = Pick<HeroPanelProps, 'session' | 'selectedDiapers' | 'availableSelectedDiapers' | 'toggleDiaperSelection' | 'logSelectedDiapers'>

export function DiaperQuickLog({ session, selectedDiapers, availableSelectedDiapers, toggleDiaperSelection, logSelectedDiapers }: DiaperQuickLogProps) {
  return (
    <div className="diaper-panel" role="group" aria-label="Diaper">
      <span className="diaper-panel-label">Diaper</span>
      {(['wet', 'stool'] as DiaperKind[]).map((kind) => {
        const selected = selectedDiapers.includes(kind)
        const label = session ? `Select ${kind} during active feed` : `Select ${kind} diaper`
        return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={label} aria-pressed={selected} onClick={() => toggleDiaperSelection(kind)}>{diaperLabel(kind)}</button>
      })}
      <button type="button" className="diaper-log-button" aria-label="Log selected diapers" disabled={availableSelectedDiapers.length === 0} onClick={logSelectedDiapers}>Log</button>
    </div>
  )
}
