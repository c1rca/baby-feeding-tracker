import type { ReactNode } from 'react'
import { oppositeSide, sideLabel } from '../../domain/trackerDomain'
import type { HeroPanelProps } from './HeroPanel.types'

type HeroActionsProps = Pick<
  HeroPanelProps,
  'session' | 'tummySession' | 'pumpSession' | 'activeSide' | 'activeOppositeSide' | 'suggestedSide' | 'startSession' | 'switchSide' | 'resume' | 'endSession'
> & {
  clearConfirming: boolean
  requestClearSession: () => void
  clearIcon: ReactNode
}

export function HeroActions({
  session,
  tummySession,
  pumpSession,
  activeSide,
  activeOppositeSide,
  suggestedSide,
  startSession,
  switchSide,
  resume,
  endSession,
  clearConfirming,
  requestClearSession,
  clearIcon,
}: HeroActionsProps) {
  return (
    // The modifier scopes the one-row sizing to an active feed. The idle Start
    // pair keeps its natural widths, where the jumbo primary is meant to
    // dominate rather than share the row evenly.
    <div className={`row hero-actions${session && !tummySession && !pumpSession ? ' hero-actions--active' : ''}`}>
      {tummySession || pumpSession ? null : !session ? (
        <>
          <button className="primary jumbo" aria-label={`Start suggested side: ${sideLabel(suggestedSide)}`} onClick={() => startSession(suggestedSide)}>Start {sideLabel(suggestedSide)}</button>
          <button onClick={() => startSession(oppositeSide(suggestedSide))}>Start {sideLabel(oppositeSide(suggestedSide))}</button>
        </>
      ) : (
        <>
          {activeSide ? (
            <button className="primary" onClick={() => switchSide(activeOppositeSide)}>Switch to {sideLabel(activeOppositeSide)}</button>
          ) : (
            <>
              <button className="primary" onClick={() => resume(suggestedSide)}>Resume {sideLabel(suggestedSide)}</button>
              <button onClick={() => resume(oppositeSide(suggestedSide))}>Resume {sideLabel(oppositeSide(suggestedSide))}</button>
            </>
          )}
          <button className="success end-feed" type="button" aria-label="End feed" onClick={endSession}>Stop & Save Feed</button>
          <button className={`active-clear-link ${clearConfirming ? 'confirming' : ''}`} type="button" aria-label={clearConfirming ? 'Confirm clear active feed' : 'Clear active feed'} onClick={requestClearSession}>{clearIcon} {clearConfirming ? 'Confirm clear' : 'Clear active'}</button>
        </>
      )}
    </div>
  )
}
