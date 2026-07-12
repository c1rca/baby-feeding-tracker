import { CirclePause, CirclePlay } from 'lucide-react'
import { formatDuration } from '../../domain/feedingUtils'
import { sideLabel } from '../../domain/trackerDomain'
import type { HeroPanelProps } from './HeroPanel.types'

type TimerClusterProps = Pick<HeroPanelProps, 'session' | 'activeSeconds' | 'activeSide' | 'suggestedSide' | 'tummySession' | 'tummyActiveSeconds' | 'pumpSession' | 'pumpActiveSeconds' | 'pause' | 'resume' | 'pauseCareTimer' | 'resumeCareTimer' | 'pausePumping' | 'resumePumping'>

export function TimerCluster({ session, activeSeconds, activeSide, suggestedSide, tummySession, tummyActiveSeconds, pumpSession, pumpActiveSeconds, pause, resume, pauseCareTimer, resumeCareTimer, pausePumping, resumePumping }: TimerClusterProps) {
  const displaySeconds = pumpSession ? pumpActiveSeconds : tummySession ? tummyActiveSeconds : activeSeconds
  const timerState = pumpSession || tummySession || (session && activeSide) ? 'is-live' : session ? 'is-paused' : 'is-idle'
  return (
    <div className="timer-cluster">
      {pumpSession ? <span className="timer-mode-pill">Pumping</span> : tummySession ? <span className="timer-mode-pill">{tummySession.kind === 'sleep' ? 'Sleep' : 'Tummy Time'}</span> : null}
      <div className={`timer-shell ${timerState}`}>
        <div className="timer-halo" aria-hidden="true" />
        <div className="timer">{formatDuration(displaySeconds)}</div>
      </div>
      {pumpSession ? <button type="button" className={`transport-toggle ${pumpSession.runningStartedAt !== null ? 'is-playing' : 'is-paused'}`} aria-label={pumpSession.runningStartedAt !== null ? 'Pause Pumping timer' : 'Resume Pumping timer'} onClick={pumpSession.runningStartedAt !== null ? pausePumping : resumePumping}>{pumpSession.runningStartedAt !== null ? <CirclePause size={22} /> : <CirclePlay size={22} />}</button> : tummySession ? <button type="button" className={`transport-toggle ${tummySession.runningStartedAt !== null ? 'is-playing' : 'is-paused'}`} aria-label={tummySession.runningStartedAt !== null ? `Pause ${tummySession.kind === 'sleep' ? 'Sleep' : 'Tummy Time'} timer` : `Resume ${tummySession.kind === 'sleep' ? 'Sleep' : 'Tummy Time'} timer`} onClick={tummySession.runningStartedAt !== null ? pauseCareTimer : resumeCareTimer}>{tummySession.runningStartedAt !== null ? <CirclePause size={22} /> : <CirclePlay size={22} />}</button> : session ? (
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
  )
}
