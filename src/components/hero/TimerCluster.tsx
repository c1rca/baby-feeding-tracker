import { CirclePause, CirclePlay } from 'lucide-react'
import { formatDuration } from '../../domain/feedingUtils'
import { sideLabel } from '../../domain/trackerDomain'
import type { HeroPanelProps } from './HeroPanel.types'

type TimerClusterProps = Pick<HeroPanelProps, 'session' | 'activeSeconds' | 'activeSide' | 'suggestedSide' | 'tummySession' | 'tummyActiveSeconds' | 'pause' | 'resume'>

export function TimerCluster({ session, activeSeconds, activeSide, suggestedSide, tummySession, tummyActiveSeconds, pause, resume }: TimerClusterProps) {
  const displaySeconds = tummySession ? tummyActiveSeconds : activeSeconds
  const timerState = tummySession || (session && activeSide) ? 'is-live' : session ? 'is-paused' : 'is-idle'
  return (
    <div className="timer-cluster">
      {tummySession ? <span className="timer-mode-pill">Tummy Time</span> : null}
      <div className={`timer-shell ${timerState}`}>
        <div className="timer-halo" aria-hidden="true" />
        <div className="timer">{formatDuration(displaySeconds)}</div>
      </div>
      {session && !tummySession ? (
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
