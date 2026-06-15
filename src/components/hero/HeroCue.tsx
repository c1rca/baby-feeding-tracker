import type { Session } from '../../types'
import type { HeroPanelProps } from './HeroPanel.types'

function sessionStatusLabel(session: Session | null) {
  if (!session) return null
  if (session.activeSide) return `On ${session.activeSide}`
  const lastSide = session.segments.at(-1)?.side
  return lastSide ? `Paused ${lastSide}` : 'Paused'
}

type HeroCueProps = Pick<HeroPanelProps, 'session' | 'nextFeedWindowText' | 'nextFeedSideText' | 'hasLastFeed'>

export function HeroCue({ session, nextFeedWindowText, nextFeedSideText, hasLastFeed }: HeroCueProps) {
  const statusLabel = sessionStatusLabel(session)

  return (
    <div className="hero-top">
      <div className="feed-cues hero-priority-cues">
        {!session ? (
          <span className="next-window">
            <span>Next</span>{' '}
            <strong>
              {nextFeedWindowText}
              {hasLastFeed ? <> <span className="next-feed-side">{nextFeedSideText}</span></> : null}
            </strong>
          </span>
        ) : null}
      </div>
      {statusLabel ? <span className="pill">{statusLabel}</span> : null}
    </div>
  )
}
