import type { ComponentProps, RefObject } from 'react'
import { CareBrief, type CareBriefExtras } from './CareBrief'
import { HeroPanel } from './HeroPanel'
import { Timeline } from './Timeline'
import { TrackOverview } from './TrackOverview'

type TrackViewProps = {
  heroRef: RefObject<HTMLElement | null>
  hero: ComponentProps<typeof HeroPanel>
  brief: CareBriefExtras
  babyName?: string
  overview: ComponentProps<typeof TrackOverview>
  timeline: ComponentProps<typeof Timeline>
}

export function TrackView({ heroRef, hero, brief, babyName, overview, timeline }: TrackViewProps) {
  const timing = Boolean(hero.session || hero.tummySession || hero.pumpSession)
  return (
    <>
      <div className="tracker-view">
        {timing ? <HeroPanel ref={heroRef} {...hero} /> : <CareBrief {...hero} {...brief} babyName={babyName} />}
        <TrackOverview {...overview} />
      </div>
      <Timeline {...timeline} onLogPastEvent={() => hero.setPastEventOpen(true)} />
    </>
  )
}
