import { CirclePause, CirclePlay } from 'lucide-react'
import { formatDuration } from '../../domain/feedingUtils'
import { sideLabel } from '../../domain/trackerDomain'
import type { HeroPanelProps } from './HeroPanel.types'

type TimerClusterProps = Pick<HeroPanelProps, 'session' | 'activeSeconds' | 'activeSide' | 'suggestedSide' | 'tummySession' | 'tummyActiveSeconds' | 'pumpSession' | 'pumpActiveSeconds' | 'pause' | 'resume' | 'pauseTummyTime' | 'resumeTummyTime' | 'pausePumping' | 'resumePumping'>

export function TimerCluster({ session, activeSeconds, activeSide, suggestedSide, tummySession, tummyActiveSeconds, pumpSession, pumpActiveSeconds, pause, resume, pauseTummyTime, resumeTummyTime, pausePumping, resumePumping }: TimerClusterProps) {
  const displaySeconds = pumpSession ? pumpActiveSeconds : tummySession ? tummyActiveSeconds : activeSeconds

  // One transport control shared by every live timer. Priority matches the
  // displayed clock: pumping, then tummy/sleep, then the feed. `paused` drives
  // both the play/pause icon and the shell's live/paused halo.
  const transport = pumpSession
    ? { paused: !pumpSession.runningStartedAt, onToggle: pumpSession.runningStartedAt ? pausePumping : resumePumping, label: 'Pumping' }
    : tummySession
      ? { paused: !tummySession.runningStartedAt, onToggle: tummySession.runningStartedAt ? pauseTummyTime : resumeTummyTime, label: tummySession.kind === 'sleep' ? 'Sleep' : 'Tummy Time' }
      : session
        ? { paused: !activeSide, onToggle: activeSide ? pause : () => resume(suggestedSide), label: 'feed' }
        : null

  const timerState = transport ? (transport.paused ? 'is-paused' : 'is-live') : 'is-idle'
  const ariaLabel = transport
    ? transport.paused
      ? transport.label === 'feed' ? `Resume feed timer on ${sideLabel(suggestedSide)}` : `Resume ${transport.label} timer`
      : `Pause ${transport.label} timer`
    : ''

  return (
    <div className="timer-cluster">
      {pumpSession ? <span className="timer-mode-pill">Pumping</span> : tummySession ? <span className="timer-mode-pill">{tummySession.kind === 'sleep' ? 'Sleep' : 'Tummy Time'}</span> : null}
      <div className={`timer-shell ${timerState}`}>
        <div className="timer-halo" aria-hidden="true" />
        <div className="timer">{formatDuration(displaySeconds)}</div>
      </div>
      {transport ? (
        <button
          type="button"
          className={`transport-toggle ${transport.paused ? 'is-paused' : 'is-playing'}`}
          aria-label={ariaLabel}
          title={transport.paused ? 'Resume' : 'Pause'}
          onClick={transport.onToggle}
        >
          {transport.paused ? <CirclePlay size={22} /> : <CirclePause size={22} />}
        </button>
      ) : null}
    </div>
  )
}
