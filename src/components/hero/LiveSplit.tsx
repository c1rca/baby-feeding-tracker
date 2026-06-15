import { formatDuration } from '../../domain/feedingUtils'
import type { HeroPanelProps } from './HeroPanel.types'

type LiveSplitProps = Pick<HeroPanelProps, 'session' | 'activeSplit'>

export function LiveSplit({ session, activeSplit }: LiveSplitProps) {
  if (!session) return null

  return (
    <div className="live-split" aria-label="Live split">
      <div className="split-title">Live split</div>
      <div><span>Left</span><strong>{formatDuration(activeSplit.left)}</strong></div>
      <div><span>Right</span><strong>{formatDuration(activeSplit.right)}</strong></div>
      <div><span>Bottle</span><strong>{session.bottleOunces.toFixed(1)} oz</strong></div>
    </div>
  )
}
