import { Droplets, Dumbbell, Milk, Moon, Pill, Play, Square, TimerReset, X } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { DialogSurface } from '../modals/ModalFrame'
import { useUnits } from '../../state/unitPreferencesContext'
import { knownCustomMedicineNames } from '../../domain/labels'
import { careTimerLabel } from '../../domain/careTimer'
import { activeCustomTrackers, customTrackerHueToken } from '../../domain/customTrackers'
import { CustomTrackerIcon } from '../customTrackerIcons'
import type { PumpSession } from '../../state/usePumpActions'
import type { DiaperKind, MedicineEvent } from '../../types'
import type { HeroPanelProps } from './HeroPanel.types'

type CareSheet = 'diapers' | 'tummy' | 'medicine' | 'pumping' | null
type AdditionalOptionsProps = Pick<HeroPanelProps, 'session' | 'additionalOptionsOpen' | 'setAdditionalOptionsOpen' | 'tummySession' | 'setTummySession' | 'setBottleOpen' | 'setSession' | 'logDiaperKinds' | 'logMedicine' | 'logTummyTimeMinutes' | 'startTummyTime' | 'stopTummyTime' | 'startSleep' | 'stopSleep' | 'customTrackers' | 'startCustomTimer'> & {
  pumpSession: PumpSession | null
  startPumping: (side: 'left' | 'both' | 'right') => void
  startManualPumping: () => void
  stopPumping: () => void
  savePumping: (left: string, right: string, note: string) => void
  pumpCompletionOpen: boolean
  setPumpCompletionOpen: (open: boolean) => void
  medicines?: MedicineEvent[]
}

const TUMMY_PRESETS = [5, 10, 15, 20] as const
const launcherItems = [
  ['diapers', 'Diapers', Droplets], ['tummy', 'Tummy', Dumbbell], ['sleep', 'Sleep', Moon],
  ['pumping', 'Pumping', TimerReset], ['medicine', 'Medicine', Pill], ['bottle', 'Bottle', Milk],
] as const

export function AdditionalOptions({ session, tummySession, customTrackers, startCustomTimer, setBottleOpen, setSession, logDiaperKinds, logMedicine, logTummyTimeMinutes, startTummyTime, stopTummyTime, startSleep, pumpSession, startPumping, startManualPumping, stopPumping, savePumping, pumpCompletionOpen, setPumpCompletionOpen, medicines = [] }: AdditionalOptionsProps) {
  const { units } = useUnits()
  const [sheet, setSheet] = useState<CareSheet>(null)
  const [pumpSide, setPumpSide] = useState<'left' | 'both' | 'right'>('left')
  const [leftOutput, setLeftOutput] = useState('')
  const [rightOutput, setRightOutput] = useState('')
  const [pumpNote, setPumpNote] = useState('')
  const [customMedicine, setCustomMedicine] = useState('')
  const knownCustomMedicines = knownCustomMedicineNames(medicines)
  const close = () => setSheet(null)
  const logDiaper = (kinds: DiaperKind[]) => { logDiaperKinds(kinds); close() }
  const selectLauncher = (kind: typeof launcherItems[number][0]) => {
    // Sleep has no quick-log presets, so its launcher starts the live timer
    // straight away; Tummy opens a sheet to choose a preset or a live timer.
    if (kind === 'sleep') return startSleep()
    if (kind === 'bottle') return setBottleOpen(true)
    setSheet(kind)
  }

  return <section className="care-actions" aria-label="Care actions">
    <div className="care-launcher" role="group" aria-label="Care action launcher">
      {launcherItems.map(([kind, label, Icon]) => <button key={kind} type="button" className={`care-launcher-button care-launcher--${kind}`} aria-label={label} onClick={() => selectLauncher(kind)}><Icon size={19} /><span>{label}</span></button>)}
      {/* Only timed trackers earn a launcher slot. The rest are a single tap in
          their own row, and duplicating them here would just crowd the grid. */}
      {activeCustomTrackers(customTrackers).filter((tracker) => tracker.timer).map((tracker) => (
        <button
          key={tracker.id}
          type="button"
          className="care-launcher-button care-launcher--custom"
          style={{ '--launcher-accent': customTrackerHueToken(tracker.hue) } as CSSProperties}
          aria-label={tracker.name}
          onClick={() => startCustomTimer(tracker.id)}
        >
          <CustomTrackerIcon icon={tracker.icon} size={19} /><span>{tracker.name}</span>
        </button>
      ))}
    </div>
    {session ? <label className="care-feed-note"><span>Note for current feed</span><input value={session.note} onChange={(event) => setSession({ ...session, note: event.target.value })} placeholder="optional note" /></label> : null}

    {sheet === 'diapers' ? <DialogSurface label="Log diaper" className="modal care-sheet care-choice-sheet" onClose={close}><header><div><span className="care-sheet-eyebrow">Quick care</span><h2>Diaper change</h2><p>What changed?</p></div><button type="button" className="icon-plain" aria-label="Close diaper menu" onClick={close}><X size={16} /></button></header><div className="care-quick-grid"><button onClick={() => logDiaper(['wet'])}><Droplets size={17} />Wet</button><button onClick={() => logDiaper(['stool'])}>Stool</button><button onClick={() => logDiaper(['wet', 'stool'])}>Mixed</button></div></DialogSurface> : null}
    {sheet === 'medicine' ? <DialogSurface label="Log medicine" className="modal care-sheet care-choice-sheet" onClose={close}><header><div><span className="care-sheet-eyebrow">Quick care</span><h2>Medicine</h2><p>Log a dose now.</p></div><button type="button" className="icon-plain" aria-label="Close medicine menu" onClick={close}><X size={16} /></button></header><div className="care-quick-grid"><button onClick={() => { logMedicine('tylenol'); close() }}>Tylenol</button><button onClick={() => { logMedicine('motrin'); close() }}>Motrin</button><button onClick={() => { logMedicine('vitamin_d'); close() }}>Vitamin D</button></div>
      <div className="care-custom-medicine">
        <label>
          <span>Something else</span>
          <input
            aria-label="Other medicine name"
            list="known-custom-medicines"
            value={customMedicine}
            placeholder="e.g. Iron drops"
            onChange={(event) => setCustomMedicine(event.target.value)}
          />
        </label>
        <datalist id="known-custom-medicines">
          {knownCustomMedicines.map((name) => <option key={name} value={name} />)}
        </datalist>
        <button type="button" className="primary" disabled={!customMedicine.trim()} aria-label="Log other medicine" onClick={() => { logMedicine('custom', customMedicine); setCustomMedicine(''); close() }}>Log dose</button>
      </div>
      <p className="care-custom-medicine-note">Anything logged here is recorded and reported, but does not get its own reminder schedule.</p>
    </DialogSurface> : null}
    {sheet === 'tummy' ? <DialogSurface label="Tummy Time" className="modal care-sheet" onClose={close}><header><div><span className="care-sheet-eyebrow">Care timer</span><h2>Tummy Time</h2><p>A quick log or a live timer—your choice.</p></div><button type="button" className="icon-plain" aria-label="Close Tummy Time" onClick={close}>×</button></header>{tummySession ? <button type="button" className="primary" onClick={() => { stopTummyTime(); close() }}><Square size={15} /> Stop & save {careTimerLabel(tummySession, customTrackers)}</button> : <><div className="care-preset-grid">{TUMMY_PRESETS.map((minutes) => <button key={minutes} onClick={() => { logTummyTimeMinutes(minutes); close() }}><strong>{minutes}</strong><span>minutes</span></button>)}</div>{session ? <p className="care-blocked">Save or clear the active feed before starting a timer.</p> : <button type="button" className="primary" onClick={() => { startTummyTime(); close() }}><Play size={15} /> Start live timer</button>}</>}</DialogSurface> : null}
    {sheet === 'pumping' ? <DialogSurface label="Start pumping" className="modal care-sheet pump-start-sheet" onClose={close}><header><div><span className="care-sheet-eyebrow">Pumping</span><h2>{pumpSession ? 'Pumping in progress' : 'Start pumping'}</h2><p>{pumpSession ? 'Your timer is running in the hero above.' : 'Choose a side, start a timer, or add output without one.'}</p></div><button type="button" className="icon-plain" aria-label="Close pumping" onClick={close}>×</button></header>{pumpSession ? <button type="button" className="primary" onClick={() => { stopPumping(); close() }}><Square size={15} /> Finish & add output</button> : <><div className="care-segmented" role="group" aria-label="Pumping side">{(['left', 'both', 'right'] as const).map((side) => <button key={side} aria-pressed={pumpSide === side} onClick={() => setPumpSide(side)}>{side[0].toUpperCase() + side.slice(1)}</button>)}</div><button type="button" className="primary" onClick={() => { startPumping(pumpSide); close() }}><Play size={15} /> Start timer</button><button type="button" className="care-secondary-action" onClick={() => { startManualPumping(); close() }}>Add output only</button></>}</DialogSurface> : null}
    {pumpCompletionOpen ? <DialogSurface label="Complete pumping session" backdropClassName="modal-backdrop pump-sheet-backdrop" className="modal pump-sheet" onClose={() => setPumpCompletionOpen(false)}><div className="pump-sheet-head"><div><span className="pump-sheet-eyebrow">Pumping output</span><h2>Finish pumping</h2><p>Enter what you collected. Leave either side blank if needed.</p></div><button type="button" className="icon-plain" aria-label="Close pumping form" onClick={() => setPumpCompletionOpen(false)}>×</button></div><div className="pump-output-grid"><label><span>Left</span><div><input type="number" min="0" step={units.volume === 'ml' ? '1' : '0.1'} inputMode="decimal" aria-label="Left output ounces" value={leftOutput} onChange={(e) => setLeftOutput(e.target.value)} /><em>{units.volume}</em></div></label><label><span>Right</span><div><input type="number" min="0" step={units.volume === 'ml' ? '1' : '0.1'} inputMode="decimal" aria-label="Right output ounces" value={rightOutput} onChange={(e) => setRightOutput(e.target.value)} /><em>{units.volume}</em></div></label></div><div className="pump-total"><strong>Total output {(Number(leftOutput) || 0) + (Number(rightOutput) || 0)} {units.volume}</strong></div><label className="pump-note"><span>Note <em>optional</em></span><input aria-label="Pumping note" value={pumpNote} onChange={(e) => setPumpNote(e.target.value)} placeholder="e.g. morning pump" /></label><div className="pump-sheet-actions"><button type="button" className="secondary" onClick={() => setPumpCompletionOpen(false)}>Cancel</button><button type="button" className="primary" aria-label="Save pumping session" onClick={() => { savePumping(leftOutput, rightOutput, pumpNote); setLeftOutput(''); setRightOutput(''); setPumpNote('') }}>Save pumping</button></div></DialogSurface> : null}
  </section>
}
