import { AlertTriangle, Droplets, Moon } from 'lucide-react'
import type { DiaperWatchModel, WakeWindowModel } from '../domain/sleepRhythm'

type RhythmSignalsCardProps = {
  hasHydrated: boolean
  wakeWindow: WakeWindowModel
  diaperWatch: DiaperWatchModel
  startSleep: () => void
  logDiaperKinds: (kinds: Array<'wet' | 'stool'>) => void
}

export function RhythmSignalsCard({ hasHydrated, wakeWindow, diaperWatch, startSleep, logDiaperKinds }: RhythmSignalsCardProps) {
  // Until local state has hydrated, "no wet diaper for 9 hours" would be a lie
  // told to a tired parent, so the card stays quiet.
  if (!hasHydrated) return null

  return (
    <section className="card rhythm-signals-card" aria-label="Rest and signals">
      <div className="care-needs-heading"><h3>Rest &amp; signals</h3></div>

      <div className={`rhythm-signal rhythm-signal--sleep is-${wakeWindow.status}`}>
        <span className="rhythm-signal-icon" aria-hidden="true"><Moon size={17} /></span>
        <div className="rhythm-signal-copy">
          <strong>{wakeWindow.asleep ? 'Sleeping' : 'Wake window'}</strong>
          <small>{wakeWindow.copy}</small>
        </div>
        {wakeWindow.asleep ? null : <button type="button" className="care-need-action" aria-label="Start sleep timer from wake window" onClick={startSleep}>Start sleep</button>}
      </div>

      <div className={`rhythm-signal rhythm-signal--diaper ${diaperWatch.alert ? 'is-alert' : ''}`}>
        <span className="rhythm-signal-icon" aria-hidden="true">{diaperWatch.alert ? <AlertTriangle size={17} /> : <Droplets size={17} />}</span>
        <div className="rhythm-signal-copy">
          <strong>Diaper watch</strong>
          <small>{diaperWatch.copy}</small>
        </div>
        <button type="button" className="care-need-action" aria-label="Log a wet diaper" onClick={() => logDiaperKinds(['wet'])}>Log wet</button>
      </div>
    </section>
  )
}
