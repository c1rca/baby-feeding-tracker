import type { ComponentProps, RefObject } from 'react'
import { CareBrief, CareNeedsCard, type CareBriefExtras } from './CareBrief'
import { HeroPanel } from './HeroPanel'
import { Timeline } from './Timeline'
import { TrackOverview } from './TrackOverview'

type TrackViewProps = {
  heroRef: RefObject<HTMLElement | null>
  hero: ComponentProps<typeof HeroPanel>
  brief: CareBriefExtras
  babyName?: string
  profileName?: string
  overview: ComponentProps<typeof TrackOverview>
  timeline: ComponentProps<typeof Timeline>
}

export function TrackView({ heroRef, hero, brief, babyName, profileName, overview, timeline }: TrackViewProps) {
  const timing = Boolean(hero.session || hero.tummySession || hero.pumpSession)
  return (
    <>
      <div className="tracker-view">
        {timing ? <HeroPanel ref={heroRef} {...hero} /> : <CareBrief {...hero} {...brief} babyName={babyName} profileName={profileName} />}
        <div className="track-dashboard-side"><CareNeedsCard {...hero} {...brief} /><TrackOverview {...overview} /></div>
      </div>
      <Timeline {...timeline} onLogPastEvent={() => hero.setPastEventOpen(true)} />
    </>
  )
}
