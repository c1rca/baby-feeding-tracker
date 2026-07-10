import { CalendarDays, ChevronDown, Dumbbell, Milk, Pill, Play, Plus, Square } from 'lucide-react'
import type { HeroPanelProps } from './HeroPanel.types'

type AdditionalOptionsProps = Pick<HeroPanelProps, 'session' | 'additionalOptionsOpen' | 'tummySession' | 'setTummySession' | 'setAdditionalOptionsOpen' | 'setBottleOpen' | 'setManualOpen' | 'setSession' | 'logMedicine' | 'logTummyTimeMinutes' | 'startTummyTime' | 'stopTummyTime'>

const TUMMY_PRESETS = [5, 10, 15, 20] as const

// Premium "More actions" drawer — organized, color-coded category cards.
// Revert path: restore this file + delete the "Additional options — premium
// redesign" block in styles.css / styles-classic.css (or git revert the commit).
export function AdditionalOptions({ session, additionalOptionsOpen, tummySession, setTummySession, setAdditionalOptionsOpen, setBottleOpen, setManualOpen, setSession, logMedicine, logTummyTimeMinutes, startTummyTime, stopTummyTime }: AdditionalOptionsProps) {
  return (
    <div className="ao-shell">
      <button
        type="button"
        className="ao-toggle"
        aria-label="Additional options"
        aria-expanded={additionalOptionsOpen}
        onClick={() => setAdditionalOptionsOpen((open) => !open)}
      >
        <span className="ao-toggle-lead">
          <span className="ao-toggle-icon"><Plus size={16} strokeWidth={2.6} /></span>
          <span className="ao-toggle-copy">
            <strong>More actions</strong>
            <small>Tummy time · medicine · bottle · missed feed</small>
          </span>
        </span>
        <ChevronDown className="ao-toggle-chevron" size={18} aria-hidden="true" />
      </button>

      {additionalOptionsOpen ? (
        <div className="ao-panel">
          <section className="ao-card ao-card--tummy" role="group" aria-label="Tummy Time">
            <header className="ao-card-head">
              <span className="ao-card-icon"><Dumbbell size={15} /></span>
              <span className="ao-card-title">Tummy time</span>
              {tummySession ? <span className="ao-live" aria-label="Tummy time running">Live</span> : null}
            </header>
            {tummySession ? (
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
                {session ? (
                  <p className="ao-hint">Save or clear the active feed before starting Tummy Time.</p>
                ) : (
                  <button type="button" className="ao-action" aria-label="Start Tummy Time" onClick={startTummyTime}>
                    <Play size={14} /> Start session
                  </button>
                )}
              </div>
            )}
          </section>

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
