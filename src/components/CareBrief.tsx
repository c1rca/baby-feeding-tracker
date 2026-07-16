import { Check, Dumbbell, Pill, Sun } from 'lucide-react'
import { oppositeSide, sideLabel } from '../domain/trackerDomain'
import { AdditionalOptions } from './hero/AdditionalOptions'
import { StartOffsetControl } from './hero/HeroCore'
import type { HeroPanelProps } from './hero/HeroPanel.types'
import type { MedicineKind } from '../types'

export type DueMedicine = { id: string; kind: MedicineKind; label: string; at: number }
export type GivenMedicine = { kind: MedicineKind; label: string; at: number }

export type CareBriefExtras = {
  now: number
  babyName?: string
  profileName?: string
  hasHydrated: boolean
  nextFeedWindow: { startMs: number; endMs: number } | null
  vitaminDTakenToday: boolean
  latestVitaminDAt: number | null
  dueMedicines: DueMedicine[]
  givenMedicines: GivenMedicine[]
  tummyMinutesToday: number
  tummyGoalMinutes: number
}

type CareBriefProps = HeroPanelProps & CareBriefExtras

const LATE_WINDOW_MS = 6 * 60 * 60 * 1000

const clockTime = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

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
    now, babyName, profileName, nextFeedWindow,
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
        {babyName ? <span className="today-brief-baby">{babyName}</span> : null}
      </header>

      <div className="today-brief-focal" data-state={cue.state}>
        <span className="today-brief-focal-label">Next feed</span>
        <div className="today-brief-window">
          <strong>{nextFeedWindowText}</strong>
          {hasLastFeed ? <span className="next-feed-side" aria-label={`${sideLabel(suggestedSide)} side next`}>{sideLabel(suggestedSide)}</span> : null}
        </div>
        <div className="hero-micro-meta today-brief-meta" aria-label="Feed timing summary">
          <span>{hasLastFeed ? `Last ${lastFeedMetaText}` : lastFeedMetaText}</span>
          {cue.state === 'first' || cue.state === 'rest' ? null : <span className="today-brief-cue" data-state={cue.state}>Next {cue.text}</span>}
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

export function CareNeedsCard({ hasHydrated, vitaminDTakenToday, latestVitaminDAt, dueMedicines, givenMedicines, tummyMinutesToday, tummyGoalMinutes, logMedicine, startTummyTime }: Pick<CareBriefProps, 'hasHydrated' | 'vitaminDTakenToday' | 'latestVitaminDAt' | 'dueMedicines' | 'givenMedicines' | 'tummyMinutesToday' | 'tummyGoalMinutes' | 'logMedicine' | 'startTummyTime'>) {
  const tummyDone = tummyGoalMinutes > 0 && tummyMinutesToday >= tummyGoalMinutes
  const tummyPercent = Math.min(100, Math.round((tummyMinutesToday / Math.max(1, tummyGoalMinutes)) * 100))
  const due = hasHydrated ? dueMedicines : []
  const given = hasHydrated ? givenMedicines : []
  const done = (vitaminDTakenToday ? 1 : 0) + (tummyDone ? 1 : 0) + given.length
  const total = 2 + due.length + given.length
  return <section className="card care-needs-card" aria-label="Today's needs"><div className="care-needs"><div className="care-needs-heading"><h3>Today's needs</h3><span>{done === total ? 'All caught up' : `${done} of ${total} done`}</span></div><div className="care-needs-list" role="group" aria-label="Today's needs">
    <div className={`care-need care-need--vitamin ${vitaminDTakenToday ? 'is-done' : ''}`}><span className="care-need-icon" aria-hidden="true">{vitaminDTakenToday ? <Check size={17} /> : <Sun size={17} />}</span><div className="care-need-copy"><strong>Vitamin D</strong><small>{vitaminDTakenToday ? (latestVitaminDAt ? `Given at ${clockTime(latestVitaminDAt)}` : 'Done for today') : 'Not given yet'}</small></div>{vitaminDTakenToday ? null : <button type="button" className="care-need-action" aria-label="Log Vitamin D dose" onClick={() => logMedicine('vitamin_d')}>Log dose</button>}</div>
    <div className={`care-need care-need--tummy ${tummyDone ? 'is-done' : ''}`}><span className="care-need-icon" aria-hidden="true">{tummyDone ? <Check size={17} /> : <Dumbbell size={17} />}</span><div className="care-need-copy"><strong>Tummy time</strong><small>{tummyDone ? `Goal met with ${tummyMinutesToday} min` : `${tummyMinutesToday} of ${tummyGoalMinutes} min`}</small>{tummyDone ? null : <div className="care-need-progress" role="progressbar" aria-label="Tummy time progress" aria-valuemin={0} aria-valuemax={tummyGoalMinutes} aria-valuenow={Math.min(tummyMinutesToday, tummyGoalMinutes)}><div style={{ width: `${tummyPercent}%` }} /></div>}</div>{tummyDone ? null : <button type="button" className="care-need-action" aria-label="Start Tummy Time timer" onClick={startTummyTime}>Start</button>}</div>
    {due.map((medicine) => <div key={medicine.id} className={`care-need care-need--${medicine.kind}`}><span className="care-need-icon" aria-hidden="true"><Pill size={17} /></span><div className="care-need-copy"><strong>{medicine.label} due</strong><small>Last dose at {clockTime(medicine.at)}</small></div><button type="button" className="care-need-action" aria-label={`Log ${medicine.label} dose`} onClick={() => logMedicine(medicine.kind)}>Log dose</button></div>)}
    {given.map((medicine) => <div key={medicine.kind} className={`care-need care-need--${medicine.kind} is-done`}><span className="care-need-icon" aria-hidden="true"><Check size={17} /></span><div className="care-need-copy"><strong>{medicine.label}</strong><small>Given at {clockTime(medicine.at)}</small></div></div>)}
  </div></div></section>
}
