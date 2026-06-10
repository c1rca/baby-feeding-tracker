import { forwardRef } from 'react'
import { Baby, CalendarDays, CirclePause, CirclePlay, Pill, XCircle } from 'lucide-react'
import { formatDuration } from '../domain/feedingUtils'
import { diaperLabel, sideLabel, oppositeSide } from '../domain/trackerDomain'
import type { DiaperKind, Session, Side } from '../types'

function sessionStatusLabel(session: Session | null) {
  if (!session) return null
  if (session.activeSide) return `On ${session.activeSide}`
  const lastSide = session.segments.at(-1)?.side
  return lastSide ? `Paused ${lastSide}` : 'Paused'
}

type HeroPanelProps = {
  session: Session | null
  activeSeconds: number
  activeSplit: { left: number; right: number }
  activeSide?: Side | null
  activeOppositeSide: Side
  suggestedSide: Side
  nextFeedWindowText: string
  nextFeedSideText: string
  lastFeedMetaText: string
  avgGapShortText: string | null
  hasLastFeed: boolean
  startOffsetOpen: boolean
  startInputMode: 'clock' | 'minutes'
  startClockText: string
  startMinutesAgo: string
  selectedStartMinutesAgo: number
  selectedDiapers: DiaperKind[]
  availableSelectedDiapers: DiaperKind[]
  additionalOptionsOpen: boolean
  setStartOffsetOpen: (updater: (open: boolean) => boolean) => void
  setStartInputMode: (mode: 'clock' | 'minutes') => void
  setStartClockText: (value: string) => void
  setStartMinutesAgo: (value: string) => void
  setAdditionalOptionsOpen: (updater: (open: boolean) => boolean) => void
  setBottleOpen: (open: boolean) => void
  setManualOpen: (open: boolean) => void
  setSession: (session: Session) => void
  startSession: (side: Side) => void
  switchSide: (side: Side) => void
  pause: () => void
  resume: (side: Side) => void
  endSession: () => void
  clearSession: () => void
  toggleDiaperSelection: (kind: DiaperKind) => void
  logSelectedDiapers: () => void
  logMedicine: (kind: 'tylenol' | 'motrin') => void
}

export const HeroPanel = forwardRef<HTMLElement, HeroPanelProps>(function HeroPanel({
  session,
  activeSeconds,
  activeSplit,
  activeSide,
  activeOppositeSide,
  suggestedSide,
  nextFeedWindowText,
  nextFeedSideText,
  lastFeedMetaText,
  avgGapShortText,
  hasLastFeed,
  startOffsetOpen,
  startInputMode,
  startClockText,
  startMinutesAgo,
  selectedStartMinutesAgo,
  selectedDiapers,
  availableSelectedDiapers,
  additionalOptionsOpen,
  setStartOffsetOpen,
  setStartInputMode,
  setStartClockText,
  setStartMinutesAgo,
  setAdditionalOptionsOpen,
  setBottleOpen,
  setManualOpen,
  setSession,
  startSession,
  switchSide,
  pause,
  resume,
  endSession,
  clearSession,
  toggleDiaperSelection,
  logSelectedDiapers,
  logMedicine,
}, ref) {
  const statusLabel = sessionStatusLabel(session)

  return (
    <section className="card hero" ref={ref}>
      <div className="hero-top"><div className="feed-cues hero-priority-cues"><span className="next-window"><span>Next</span>{' '}<strong>{nextFeedWindowText}{hasLastFeed ? <> <span className="next-feed-side">{nextFeedSideText}</span></> : null}</strong></span></div>{statusLabel ? <span className="pill">{statusLabel}</span> : null}</div>
      <div className="timer-cluster">
        <div className="timer">{formatDuration(activeSeconds)}</div>
        {session ? (
          <button
            type="button"
            className={`transport-toggle ${activeSide ? 'is-playing' : 'is-paused'}`}
            aria-label={activeSide ? 'Pause feed timer' : `Resume feed timer on ${sideLabel(suggestedSide)}`}
            title={activeSide ? 'Pause' : `Resume ${sideLabel(suggestedSide)}`}
            onClick={activeSide ? pause : () => resume(suggestedSide)}
          >
            {activeSide ? <CirclePause size={22} /> : <CirclePlay size={22} />}
          </button>
        ) : null}
      </div>
      <div className="hero-micro-meta" aria-label="Feed timing summary">
        <span>{hasLastFeed ? `Last ${lastFeedMetaText}` : lastFeedMetaText}</span>
        {avgGapShortText ? <span>{avgGapShortText}</span> : null}
      </div>
      {session ? (
        <div className="live-split" aria-label="Live split">
          <div className="split-title">Live split</div>
          <div><span>Left</span><strong>{formatDuration(activeSplit.left)}</strong></div>
          <div><span>Right</span><strong>{formatDuration(activeSplit.right)}</strong></div>
          <div><span>Bottle</span><strong>{session.bottleOunces.toFixed(1)} oz</strong></div>
        </div>
      ) : null}
      {!session ? (
        <div className={`start-offset-shell ${startOffsetOpen ? 'expanded' : ''}`}>
          <button type="button" className="start-offset-toggle" aria-label="Adjust start time" aria-expanded={startOffsetOpen} onClick={() => setStartOffsetOpen((open) => !open)}>
            <span>Start time</span>
            <strong>{selectedStartMinutesAgo === 0 ? 'Now' : `${selectedStartMinutesAgo} min ago`}</strong>
          </button>
          {startOffsetOpen ? (
            <div className="start-offset-panel" aria-label="Session start offset">
              <div className="start-tabs" role="tablist" aria-label="Session start input mode">
                <button type="button" role="tab" aria-selected={startInputMode === 'clock'} className={startInputMode === 'clock' ? 'active-tab' : ''} onClick={() => setStartInputMode('clock')}>Clock time</button>
                <button type="button" role="tab" aria-selected={startInputMode === 'minutes'} className={startInputMode === 'minutes' ? 'active-tab' : ''} onClick={() => setStartInputMode('minutes')}>Minutes ago</button>
              </div>
              {startInputMode === 'clock' ? (
                <label>Session start time<input value={startClockText} onChange={(e) => setStartClockText(e.target.value)} placeholder="12:30 PM" /></label>
              ) : (
                <label>Start minutes ago<input inputMode="decimal" value={startMinutesAgo} onChange={(e) => setStartMinutesAgo(e.target.value)} placeholder="5" /></label>
              )}
              <span className="start-offset-summary">{selectedStartMinutesAgo === 0 ? 'Starting now' : `${selectedStartMinutesAgo} min ago`}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="row hero-actions">
        {!session ? (<><button className="primary jumbo" aria-label={`Start suggested side: ${sideLabel(suggestedSide)}`} onClick={() => startSession(suggestedSide)}>Start {sideLabel(suggestedSide)}</button><button onClick={() => startSession(oppositeSide(suggestedSide))}>Start {sideLabel(oppositeSide(suggestedSide))}</button></>) : (<>{activeSide ? (<button className="primary" onClick={() => switchSide(activeOppositeSide)}>Switch to {sideLabel(activeOppositeSide)}</button>) : (<><button className="primary" onClick={() => resume(suggestedSide)}>Resume {sideLabel(suggestedSide)}</button><button onClick={() => resume(oppositeSide(suggestedSide))}>Resume {sideLabel(oppositeSide(suggestedSide))}</button></>)}<button className="success end-feed" type="button" aria-label="End feed" onClick={endSession}>Stop & Save Feed</button><button className="active-clear-link" type="button" aria-label="Clear active feed" onClick={clearSession}><XCircle size={14} /> Clear active</button></>)}
      </div>
      <div className="diaper-panel" role="group" aria-label="Diaper">
        <span className="diaper-panel-label">Diaper</span>
        {(['wet', 'stool'] as DiaperKind[]).map((kind) => {
          const selected = selectedDiapers.includes(kind)
          const label = session ? `Select ${kind} during active feed` : `Select ${kind} diaper`
          return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={label} aria-pressed={selected} onClick={() => toggleDiaperSelection(kind)}>{diaperLabel(kind)}</button>
        })}
        <button type="button" className="diaper-log-button" aria-label="Log selected diapers" disabled={availableSelectedDiapers.length === 0} onClick={logSelectedDiapers}>Log</button>
      </div>
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
            {!session ? (
              <div className="medicine-panel" role="group" aria-label="Missed feed">
                <span className="diaper-panel-label">Missed feed</span>
                <button type="button" onClick={() => setManualOpen(true)}><CalendarDays size={14} /> Add missed feed</button>
              </div>
            ) : null}
            <div className="medicine-panel" role="group" aria-label="Medicine">
              <span className="diaper-panel-label">Medicine</span>
              <button type="button" aria-label="Log Tylenol" onClick={() => logMedicine('tylenol')}><Pill size={14} /> Tylenol</button>
              <button type="button" aria-label="Log Motrin" onClick={() => logMedicine('motrin')}><Pill size={14} /> Motrin</button>
            </div>
            {session ? <div className="edit-panel"><label>Optional note for this feed<input value={session.note} onChange={(v) => setSession({ ...session, note: v.target.value })} placeholder="optional note" /></label></div> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
})
