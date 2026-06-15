import { Baby, CalendarDays, Pill } from 'lucide-react'
import type { HeroPanelProps } from './HeroPanel.types'

type AdditionalOptionsProps = Pick<HeroPanelProps, 'session' | 'additionalOptionsOpen' | 'setAdditionalOptionsOpen' | 'setBottleOpen' | 'setManualOpen' | 'setSession' | 'logMedicine'>

export function AdditionalOptions({ session, additionalOptionsOpen, setAdditionalOptionsOpen, setBottleOpen, setManualOpen, setSession, logMedicine }: AdditionalOptionsProps) {
  return (
    <div className="additional-options-shell">
      <button type="button" className="additional-options-toggle" aria-label="Additional options" aria-expanded={additionalOptionsOpen} onClick={() => setAdditionalOptionsOpen((open) => !open)}>
        <span>Additional options</span><strong>{additionalOptionsOpen ? 'Hide' : 'Show'}</strong>
      </button>
      {additionalOptionsOpen ? (
        <div className="additional-options-panel">
          <div className="medicine-panel" role="group" aria-label="Bottle feed">
            <span className="diaper-panel-label">Bottle</span>
            <button type="button" aria-label={session ? 'Add bottle to this feed' : 'Log bottle-only feed'} onClick={() => setBottleOpen(true)}><Baby size={14} /> Bottle</button>
          </div>
          <div className="medicine-panel" role="group" aria-label="Missed feed">
            <span className="diaper-panel-label">Missed feed</span>
            <button type="button" onClick={() => setManualOpen(true)}><CalendarDays size={14} /> Add missed feed</button>
          </div>
          <div className="medicine-panel" role="group" aria-label="Medicine">
            <span className="diaper-panel-label">Medicine</span>
            <button type="button" aria-label="Log Tylenol" onClick={() => logMedicine('tylenol')}><Pill size={14} /> Tylenol</button>
            <button type="button" aria-label="Log Motrin" onClick={() => logMedicine('motrin')}><Pill size={14} /> Motrin</button>
          </div>
          {session ? <div className="edit-panel"><label>Optional note for this feed<input value={session.note} onChange={(v) => setSession({ ...session, note: v.target.value })} placeholder="optional note" /></label></div> : null}
        </div>
      ) : null}
    </div>
  )
}
