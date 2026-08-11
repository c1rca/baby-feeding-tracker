import { oppositeSide, sideLabel } from '../domain/trackerDomain'
import { AdditionalOptions } from './hero/AdditionalOptions'
import { StartOffsetControl } from './hero/HeroCore'
import { buildCareNeeds, CareNeedRow, type DueMedicine, type GivenMedicine } from './careNeeds'
import { BabyPhotoMenu, type BabyPhotoMenuProps } from './BabyPhotoMenu'
import type { HeroPanelProps } from './hero/HeroPanel.types'
import type { CustomEvent, CustomTracker } from '../types'

export type { DueMedicine, GivenMedicine }

export type CareBriefExtras = {
  now: number
  babyName?: string
  babyPhoto?: string
  profileName?: string
  hasHydrated: boolean
  nextFeedWindow: { startMs: number; endMs: number } | null
  vitaminDTakenToday: boolean
  latestVitaminDAt: number | null
  dueMedicines: DueMedicine[]
  givenMedicines: GivenMedicine[]
  tummyMinutesToday: number
  tummyGoalMinutes: number
  pumpGoalOunces: number
  pumpGoalSessions: number
  pumpedOzToday: number
  pumpCountToday: number
  photoMenu?: Omit<BabyPhotoMenuProps, 'babyName' | 'babyPhoto'>
  customTrackers: CustomTracker[]
  customEvents: CustomEvent[]
  /** The tracker whose timer holds the shared care-timer slot, if any. */
  runningTrackerId: string | null
  logCustomEvent: (trackerId: string) => void
  stopCustomTimer: () => void
}

type CareBriefProps = HeroPanelProps & CareBriefExtras

const LATE_WINDOW_MS = 6 * 60 * 60 * 1000

const greetingFor = (hour: number) => {
  if (hour < 5) return 'Night watch'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const formatDelta = (ms: number) => {
  const minutes = Math.max(1, Math.round(ms / 60000))
  const hours = Math.floor(minutes / 60)
  if (hours === 0) return `${minutes}m`
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

type FeedCueState = 'first' | 'upcoming' | 'open' | 'late' | 'rest'

const feedCue = (window: { startMs: number; endMs: number } | null, hasLastFeed: boolean, now: number): { state: FeedCueState; text: string } => {
  if (!hasLastFeed || !window) return { state: 'first', text: 'After first feed' }
  if (now < window.startMs) return { state: 'upcoming', text: `in ${formatDelta(window.startMs - now)}` }
  if (now <= window.endMs) return { state: 'open', text: 'Window open' }
  if (now - window.endMs <= LATE_WINDOW_MS) return { state: 'late', text: 'Running late' }
  return { state: 'rest', text: 'Ready when you are' }
}

export function CareBrief(props: CareBriefProps) {
  const {
    now, babyName, babyPhoto, profileName, nextFeedWindow,
    session, suggestedSide, nextFeedWindowText, lastFeedMetaText, avgGapShortText, hasLastFeed,
    startSession,
    startOffsetOpen, startInputMode, startClockText, startMinutesAgo, selectedStartMinutesAgo,
    setStartOffsetOpen, setStartInputMode, setStartClockText, setStartMinutesAgo,
  } = props
  const greeting = greetingFor(new Date(now).getHours())
  const greetingLine = profileName?.trim() ? `${greeting}, ${profileName.trim()}` : greeting
  const dateText = new Date(now).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  const cue = feedCue(nextFeedWindow, hasLastFeed, now)
  const otherSide = oppositeSide(suggestedSide)

  return (
    <section className="card today-brief" aria-label="Today's care summary">
      <header className="today-brief-head">
        <div>
          <span className="today-brief-kicker">{greetingLine}</span>
          <h2 className="today-brief-date">{dateText}</h2>
        </div>
        <BabyPhotoMenu {...(props.photoMenu ?? { canEdit: false })} babyName={babyName} babyPhoto={babyPhoto} />
      </header>

      <div className="today-brief-focal" data-state={cue.state}>
        <span className="today-brief-focal-label">Next feed</span>
        <div className="today-brief-window">
          <strong>{nextFeedWindowText}</strong>
          {hasLastFeed ? <span className="next-feed-side" aria-label={`${sideLabel(suggestedSide)} side next`}>{sideLabel(suggestedSide).charAt(0)}</span> : null}
        </div>
        <div className="hero-micro-meta today-brief-meta" aria-label="Feed timing summary">
          {cue.state === 'first' || cue.state === 'rest' ? null : <span className="today-brief-cue" data-state={cue.state}>Next {cue.text}</span>}
          <span>{hasLastFeed ? `Last ${lastFeedMetaText}` : lastFeedMetaText}</span>
          {avgGapShortText ? <span>{avgGapShortText}</span> : null}
        </div>
      </div>

      <div className="row hero-actions today-brief-actions">
        <button type="button" className="primary jumbo" aria-label={`Start suggested side: ${sideLabel(suggestedSide)}`} onClick={() => startSession(suggestedSide)}>Start {sideLabel(suggestedSide)}</button>
        <button type="button" onClick={() => startSession(otherSide)}>Start {sideLabel(otherSide)}</button>
      </div>
      <StartOffsetControl
        session={session}
        startOffsetOpen={startOffsetOpen}
        startInputMode={startInputMode}
        startClockText={startClockText}
        startMinutesAgo={startMinutesAgo}
        selectedStartMinutesAgo={selectedStartMinutesAgo}
        setStartOffsetOpen={setStartOffsetOpen}
        setStartInputMode={setStartInputMode}
        setStartClockText={setStartClockText}
        setStartMinutesAgo={setStartMinutesAgo}
      />

      <AdditionalOptions
        session={props.session}
        additionalOptionsOpen={props.additionalOptionsOpen}
        setAdditionalOptionsOpen={props.setAdditionalOptionsOpen}
        tummySession={props.tummySession}
        setTummySession={props.setTummySession}
        setBottleOpen={props.setBottleOpen}
        setSession={props.setSession}
        logDiaperKinds={props.logDiaperKinds}
        logMedicine={props.logMedicine}
        medicines={props.medicines}
        customTrackers={props.customTrackers}
        startCustomTimer={props.startCustomTimer}
        logTummyTimeMinutes={props.logTummyTimeMinutes}
        startTummyTime={props.startTummyTime}
        stopTummyTime={props.stopTummyTime}
        startSleep={props.startSleep}
        stopSleep={props.stopSleep}
        pumpSession={props.pumpSession}
        startPumping={props.startPumping}
        startManualPumping={props.startManualPumping}
        stopPumping={props.stopPumping}
        savePumping={props.savePumping}
        pumpCompletionOpen={props.pumpCompletionOpen}
        setPumpCompletionOpen={props.setPumpCompletionOpen}
      />
    </section>
  )
}

type CareNeedsCardProps = Pick<CareBriefProps,
  'now' | 'hasHydrated' | 'vitaminDTakenToday' | 'latestVitaminDAt' | 'dueMedicines' | 'givenMedicines'
  | 'tummyMinutesToday' | 'tummyGoalMinutes' | 'pumpGoalOunces' | 'pumpGoalSessions' | 'pumpedOzToday' | 'pumpCountToday'
  | 'customTrackers' | 'customEvents' | 'runningTrackerId' | 'logMedicine' | 'startTummyTime' | 'logCustomEvent' | 'startCustomTimer' | 'stopCustomTimer'>

export function CareNeedsCard(props: CareNeedsCardProps) {
  const needs = buildCareNeeds(props)
  const done = needs.filter((need) => need.done).length
  return <section className="card care-needs-card" aria-label="Today's needs"><div className="care-needs"><div className="care-needs-heading"><h3>Today's needs</h3><span>{done === needs.length ? 'All caught up' : `${done} of ${needs.length} done`}</span></div><div className="care-needs-list" role="group" aria-label="Today's needs">
    {needs.map((need) => <CareNeedRow key={need.key} need={need} />)}
  </div></div></section>
}
