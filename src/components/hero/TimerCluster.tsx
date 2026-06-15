import { CirclePause, CirclePlay } from 'lucide-react'
import { formatDuration } from '../../domain/feedingUtils'
import { sideLabel } from '../../domain/trackerDomain'
import type { HeroPanelProps } from './HeroPanel.types'

type TimerClusterProps = Pick<HeroPanelProps, 'session' | 'activeSeconds' | 'activeSide' | 'suggestedSide' | 'pause' | 'resume'>

export function TimerCluster({ session, activeSeconds, activeSide, suggestedSide, pause, resume }: TimerClusterProps) {
  return (
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
  )
}
