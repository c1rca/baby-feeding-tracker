import type { ComponentProps, RefObject } from 'react'
import { HeroPanel } from './HeroPanel'
import { Timeline } from './Timeline'
import { TrackOverview } from './TrackOverview'

type TrackViewProps = {
  heroRef: RefObject<HTMLElement | null>
  hero: ComponentProps<typeof HeroPanel>
  overview: ComponentProps<typeof TrackOverview>
  timeline: ComponentProps<typeof Timeline>
}

export function TrackView({ heroRef, hero, overview, timeline }: TrackViewProps) {
  return (
    <>
      <div className="tracker-view">
        <HeroPanel ref={heroRef} {...hero} />
        <TrackOverview {...overview} />
      </div>
      <Timeline {...timeline} />
    </>
  )
}
