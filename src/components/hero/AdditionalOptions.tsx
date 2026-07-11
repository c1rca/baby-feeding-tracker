import { CalendarDays, ChevronDown, Droplets, Dumbbell, Milk, Moon, Pill, Play, Square, TimerReset } from 'lucide-react'
import { useState } from 'react'
import type { PumpSession } from '../../state/usePumpActions'
import type { DiaperKind } from '../../types'
import type { HeroPanelProps } from './HeroPanel.types'

type AdditionalOptionsProps = Pick<HeroPanelProps, 'session' | 'additionalOptionsOpen' | 'tummySession' | 'setTummySession' | 'setAdditionalOptionsOpen' | 'setBottleOpen' | 'setManualOpen' | 'setSession' | 'logDiaperKinds' | 'logMedicine' | 'logTummyTimeMinutes' | 'startTummyTime' | 'stopTummyTime' | 'startSleep' | 'stopSleep'> & { pumpSession: PumpSession | null; startPumping: (side: 'left' | 'both' | 'right') => void; startManualPumping: () => void; stopPumping: () => void; savePumping: (left: string, right: string, note: string) => void; pumpCompletionOpen: boolean; setPumpCompletionOpen: (open: boolean) => void }

const TUMMY_PRESETS = [5, 10, 15, 20] as const

// Premium "More actions" drawer — organized, color-coded category cards.
// Revert path: restore this file + delete the "Additional options — premium
// redesign" block in styles.css / styles-classic.css (or git revert the commit).
export function AdditionalOptions({ session, additionalOptionsOpen, tummySession, setTummySession, setAdditionalOptionsOpen, setBottleOpen, setManualOpen, setSession, logDiaperKinds, logMedicine, logTummyTimeMinutes, startTummyTime, stopTummyTime, startSleep, stopSleep, pumpSession, startPumping, startManualPumping, stopPumping, savePumping, pumpCompletionOpen, setPumpCompletionOpen }: AdditionalOptionsProps) {
  const [pumpSide, setPumpSide] = useState<'left' | 'both' | 'right'>('left')
  const [leftOutput, setLeftOutput] = useState('')
  const [rightOutput, setRightOutput] = useState('')
  const [pumpNote, setPumpNote] = useState('')
  return (
    <div className="ao-shell">
      <button
        type="button"
        className="ao-toggle"
        aria-label="Additional options"
        aria-expanded={additionalOptionsOpen}
        onClick={() => setAdditionalOptionsOpen((open) => !open)}
      >
        <span className="ao-toggle-copy">
          <strong>More actions</strong>
        </span>
        <ChevronDown className="ao-toggle-chevron" size={18} aria-hidden="true" />
      </button>

      {additionalOptionsOpen ? (
        <div className="ao-panel">
          {!session ? <section className="ao-card ao-card--diapers" role="group" aria-label="Diapers">
            <header className="ao-card-head">
              <span className="ao-card-icon"><Droplets size={15} /></span>
              <span className="ao-card-title">Diapers</span>
            </header>
            <div className="ao-card-body ao-diaper-actions">
              {([['wet', 'Wet'], ['stool', 'Stool'], ['mixed', 'Mixed']] as const).map(([kind, label]) => (
                <button key={kind} type="button" className={`ao-diaper ao-diaper--${kind}`} aria-label={`Log ${label.toLowerCase()} diaper`} onClick={() => logDiaperKinds(kind === 'mixed' ? ['wet', 'stool'] : [kind as DiaperKind])}>{kind === 'mixed' ? 'Combo' : label}</button>
              ))}
            </div>
          </section> : null}

          <section className="ao-card ao-card--tummy" role="group" aria-label="Tummy Time">
            <header className="ao-card-head">
              <span className="ao-card-icon"><Dumbbell size={15} /></span>
              <span className="ao-card-title">Tummy time</span>
              {tummySession && tummySession.kind !== 'sleep' ? <span className="ao-live" aria-label="Tummy time running">Live</span> : null}
            </header>
            {tummySession && tummySession.kind !== 'sleep' ? (
              <div className="ao-card-body">
                <button type="button" className="ao-action ao-action--stop" aria-label="Stop Tummy Time" onClick={stopTummyTime}>
                  <Square size={14} /> Stop session
                </button>
                <label className="ao-note">
                  <span>Tummy note</span>
                  <input value={tummySession.note} onChange={(event) => setTummySession({ ...tummySession, note: event.target.value })} placeholder="optional note" />
                </label>
              </div>
            ) : (
              <div className="ao-card-body">
                <div className="ao-chips" aria-label="Tummy Time quick add">
                  {TUMMY_PRESETS.map((minutes) => (
                    <button key={minutes} type="button" className="ao-chip" aria-label={`Add ${minutes} min Tummy Time`} onClick={() => logTummyTimeMinutes(minutes)}>
                      <span className="ao-chip-num">{minutes}</span>
                      <span className="ao-chip-unit">min</span>
                    </button>
                  ))}
                </div>
                {session || tummySession ? (
                  <p className="ao-hint">{tummySession?.kind === 'sleep' ? 'Stop Sleep before starting Tummy Time.' : 'Save or clear the active feed before starting Tummy Time.'}</p>
                ) : (
                  <button type="button" className="ao-action" aria-label="Start Tummy Time" onClick={startTummyTime}>
                    <Play size={14} /> Start session
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="ao-card ao-card--sleep" role="group" aria-label="Sleep">
            <header className="ao-card-head">
              <span className="ao-card-icon"><Moon size={15} /></span>
              <span className="ao-card-title">Sleep</span>
              {tummySession?.kind === 'sleep' ? <span className="ao-live" aria-label="Sleep running">Live</span> : null}
            </header>
            <div className="ao-card-body">
              {tummySession?.kind === 'sleep' ? (
                <>
                  <button type="button" className="ao-action ao-action--stop" aria-label="Stop Sleep" onClick={stopSleep}><Square size={14} /> Stop session</button>
                  <label className="ao-note">
                    <span>Sleep note</span>
                    <input value={tummySession.note} onChange={(event) => setTummySession({ ...tummySession, note: event.target.value })} placeholder="optional note" />
                  </label>
                </>
              ) : tummySession ? (
                <p className="ao-hint">Stop Tummy Time before starting Sleep.</p>
              ) : session ? (
                <p className="ao-hint">Save or clear the active feed before starting Sleep.</p>
              ) : (
                <button type="button" className="ao-action" aria-label="Start Sleep" onClick={startSleep}><Play size={14} /> Start session</button>
              )}
            </div>
          </section>

          <section className="ao-card ao-card--pumping" role="group" aria-label="Pumping">
            <header className="ao-card-head"><span className="ao-card-icon"><TimerReset size={15} /></span><span className="ao-card-title">Pumping</span>{pumpSession ? <span className="ao-live">Live</span> : <span className="ao-card-caption">Output</span>}</header>
            <div className="ao-card-body">
              {pumpSession ? <div className="pump-live"><strong>Pumping in progress</strong><span>Timer is running in the hero above.</span><button type="button" className="ao-action ao-action--stop" aria-label="Stop pumping" onClick={stopPumping}><Square size={14} /> Finish & add output</button></div> : <><div className="pump-side-picker" role="group" aria-label="Output side"><button type="button" aria-label="Left pumping side" aria-pressed={pumpSide === 'left'} onClick={() => setPumpSide('left')}>Left</button><button type="button" aria-pressed={pumpSide === 'both'} onClick={() => setPumpSide('both')}>Both</button><button type="button" aria-pressed={pumpSide === 'right'} onClick={() => setPumpSide('right')}>Right</button></div><div className="pump-actions"><button type="button" className="ao-action" aria-label="Start pumping" onClick={() => startPumping(pumpSide)}><Play size={14} /> Start timer</button><button type="button" className="pump-manual" aria-label="Add pumping output without timer" onClick={startManualPumping}>Add output only</button></div></>}
            </div>
          </section>
          {pumpCompletionOpen ? <div className="modal-backdrop pump-sheet-backdrop"><div className="modal pump-sheet" role="dialog" aria-modal="true" aria-label="Complete pumping session"><div className="pump-sheet-head"><div><span className="pump-sheet-eyebrow">Pumping output</span><h2>{pumpSession ? 'Finish pumping' : 'Add pumping output'}</h2><p>Enter what you collected. You can leave either side blank.</p></div><button type="button" className="icon-plain" aria-label="Close pumping form" onClick={() => setPumpCompletionOpen(false)}>×</button></div><div className="pump-output-grid"><label><span>Left</span><div><input type="number" min="0" step="0.1" inputMode="decimal" aria-label="Left output ounces" value={leftOutput} onChange={(e) => setLeftOutput(e.target.value)} /><em>oz</em></div></label><label><span>Right</span><div><input type="number" min="0" step="0.1" inputMode="decimal" aria-label="Right output ounces" value={rightOutput} onChange={(e) => setRightOutput(e.target.value)} /><em>oz</em></div></label></div><div className="pump-total"><strong>Total output {(Number(leftOutput) || 0) + (Number(rightOutput) || 0)} oz</strong></div><label className="pump-note"><span>Note <em>optional</em></span><input aria-label="Pumping note" value={pumpNote} onChange={(e) => setPumpNote(e.target.value)} placeholder="e.g. morning pump" /></label><div className="pump-sheet-actions"><button type="button" className="secondary" onClick={() => setPumpCompletionOpen(false)}>Cancel</button><button type="button" className="primary" aria-label="Save pumping session" onClick={() => { savePumping(leftOutput, rightOutput, pumpNote); setLeftOutput(''); setRightOutput(''); setPumpNote('') }}>Save pumping</button></div></div></div> : null}

          <section className="ao-card ao-card--medicine" role="group" aria-label="Medicine">
            <header className="ao-card-head">
              <span className="ao-card-icon"><Pill size={15} /></span>
              <span className="ao-card-title">Medicine</span>
            </header>
            <div className="ao-card-body">
              <div className="ao-chips ao-chips--meds">
                <button type="button" className="ao-med ao-med--tylenol" aria-label="Log Tylenol" onClick={() => logMedicine('tylenol')}>Tylenol</button>
                <button type="button" className="ao-med ao-med--motrin" aria-label="Log Motrin" onClick={() => logMedicine('motrin')}>Motrin</button>
                <button type="button" className="ao-med ao-med--vitamin" aria-label="Log Vitamin D" onClick={() => logMedicine('vitamin_d')}>Vitamin D</button>
              </div>
            </div>
          </section>

          <section className="ao-card ao-card--bottle" role="group" aria-label="Bottle feed">
            <header className="ao-card-head">
              <span className="ao-card-icon"><Milk size={15} /></span>
              <span className="ao-card-title">Bottle</span>
            </header>
            <div className="ao-card-body">
              <button type="button" className="ao-action ao-action--wide" aria-label={session ? 'Add bottle to this feed' : 'Log bottle-only feed'} onClick={() => setBottleOpen(true)}>
                <Milk size={14} /> {session ? 'Add bottle' : 'Log bottle'}
              </button>
            </div>
          </section>

          <section className="ao-card ao-card--missed" role="group" aria-label="Missed feed">
            <header className="ao-card-head">
              <span className="ao-card-icon"><CalendarDays size={15} /></span>
              <span className="ao-card-title">Missed feed</span>
            </header>
            <div className="ao-card-body">
              <button type="button" className="ao-action ao-action--wide" aria-label="Add missed feed" onClick={() => setManualOpen(true)}>
                <CalendarDays size={14} /> Add missed feed
              </button>
            </div>
          </section>

          {session ? (
            <label className="ao-note ao-note--feed">
              <span>Optional note for this feed</span>
              <input value={session.note} onChange={(event) => setSession({ ...session, note: event.target.value })} placeholder="optional note" />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
