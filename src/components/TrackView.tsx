import type { ComponentProps, RefObject } from 'react'
import { CareBrief, CareNeedsCard, type CareBriefExtras } from './CareBrief'
import { RhythmSignalsCard } from './RhythmSignalsCard'
import { HeroPanel } from './HeroPanel'
import { Timeline } from './Timeline'
import { TrackOverview } from './TrackOverview'

type TrackViewProps = {
  heroRef: RefObject<HTMLElement | null>
  hero: ComponentProps<typeof HeroPanel>
  brief: CareBriefExtras
  babyName?: string
  babyPhoto?: string
  photoMenu?: CareBriefExtras['photoMenu']
  profileName?: string
  overview: ComponentProps<typeof TrackOverview>
  signals: ComponentProps<typeof RhythmSignalsCard>
  timeline: ComponentProps<typeof Timeline>
}

// Rest & signals is off by default: its wake-window and diaper-gap copy is
// inferred rather than logged, so it states things the caregiver did not record.
// Set VITE_SHOW_RHYTHM_SIGNALS=1 at build time to bring the card back.
//
// Read per render, not once at module load. Vite still substitutes the literal
// at build time so the branch is eliminated exactly as before, but tests can
// drive it with stubEnv instead of fighting ES import hoisting.
const showRhythmSignals = () => import.meta.env.VITE_SHOW_RHYTHM_SIGNALS === '1'

export function TrackView({ heroRef, hero, brief, babyName, babyPhoto, photoMenu, profileName, overview, signals, timeline }: TrackViewProps) {
  const timing = Boolean(hero.session || hero.tummySession || hero.pumpSession)
  return (
    <>
      <div className="tracker-view">
        {timing ? <HeroPanel ref={heroRef} {...hero} /> : <CareBrief {...hero} {...brief} babyName={babyName} babyPhoto={babyPhoto} photoMenu={photoMenu} profileName={profileName} />}
        <div className="track-dashboard-side"><CareNeedsCard {...hero} {...brief} />{showRhythmSignals() ? <RhythmSignalsCard {...signals} /> : null}<TrackOverview {...overview} /></div>
      </div>
      <Timeline {...timeline} onLogPastEvent={() => hero.setPastEventOpen(true)} />
    </>
  )
}
