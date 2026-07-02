import { forwardRef, useState } from 'react'
import { XCircle } from 'lucide-react'
import { AdditionalOptions } from './hero/AdditionalOptions'
import { DiaperQuickLog, HeroActions, HeroCue, LiveSplit, StartOffsetControl, TimerCluster } from './hero/HeroCore'
import type { HeroPanelProps } from './hero/HeroPanel.types'

export const HeroPanel = forwardRef<HTMLElement, HeroPanelProps>(function HeroPanel({
  session,
  activeSeconds,
  activeSplit,
  activeSide,
  activeOppositeSide,
  suggestedSide,
  nextFeedWindowText,
  nextFeedSideText,
  lastFeedMetaText,
  avgGapShortText,
  hasLastFeed,
  startOffsetOpen,
  startInputMode,
  startClockText,
  startMinutesAgo,
  selectedStartMinutesAgo,
  selectedDiapers,
  availableSelectedDiapers,
  additionalOptionsOpen,
  tummySession,
  tummyActiveSeconds,
  setTummySession,
  setStartOffsetOpen,
  setStartInputMode,
  setStartClockText,
  setStartMinutesAgo,
  setAdditionalOptionsOpen,
  setBottleOpen,
  setManualOpen,
  setSession,
  startSession,
  switchSide,
  pause,
  resume,
  endSession,
  clearSession,
  toggleDiaperSelection,
  logSelectedDiapers,
  logMedicine,
  logTummyTimeMinutes,
  startTummyTime,
  stopTummyTime,
}, ref) {
  const [clearConfirmingFor, setClearConfirmingFor] = useState<number | null>(null)
  const clearConfirming = Boolean(session && clearConfirmingFor === session.startedAt)

  const requestClearSession = () => {
    if (!session) return
    if (!clearConfirming) {
      setClearConfirmingFor(session.startedAt)
      return
    }
    setClearConfirmingFor(null)
    clearSession()
  }

  return (
    <section className="card hero" ref={ref}>
      <HeroCue session={session} nextFeedWindowText={nextFeedWindowText} nextFeedSideText={nextFeedSideText} hasLastFeed={hasLastFeed} />
      <TimerCluster session={session} activeSeconds={activeSeconds} activeSide={activeSide} suggestedSide={suggestedSide} tummySession={tummySession} tummyActiveSeconds={tummyActiveSeconds} pause={pause} resume={resume} />
      <div className="hero-micro-meta" aria-label="Feed timing summary">
        <span>{hasLastFeed ? `Last ${lastFeedMetaText}` : lastFeedMetaText}</span>
        {avgGapShortText ? <span>{avgGapShortText}</span> : null}
      </div>
      <LiveSplit session={session} activeSplit={activeSplit} />
      <StartOffsetControl session={session} startOffsetOpen={startOffsetOpen} startInputMode={startInputMode} startClockText={startClockText} startMinutesAgo={startMinutesAgo} selectedStartMinutesAgo={selectedStartMinutesAgo} setStartOffsetOpen={setStartOffsetOpen} setStartInputMode={setStartInputMode} setStartClockText={setStartClockText} setStartMinutesAgo={setStartMinutesAgo} />
      <HeroActions session={session} tummySession={tummySession} activeSide={activeSide} activeOppositeSide={activeOppositeSide} suggestedSide={suggestedSide} startSession={startSession} switchSide={switchSide} resume={resume} endSession={endSession} clearConfirming={clearConfirming} requestClearSession={requestClearSession} clearIcon={<XCircle size={14} />} />
      <DiaperQuickLog session={session} selectedDiapers={selectedDiapers} availableSelectedDiapers={availableSelectedDiapers} toggleDiaperSelection={toggleDiaperSelection} logSelectedDiapers={logSelectedDiapers} />
      <AdditionalOptions session={session} additionalOptionsOpen={additionalOptionsOpen} tummySession={tummySession} setTummySession={setTummySession} setAdditionalOptionsOpen={setAdditionalOptionsOpen} setBottleOpen={setBottleOpen} setManualOpen={setManualOpen} setSession={setSession} logMedicine={logMedicine} logTummyTimeMinutes={logTummyTimeMinutes} startTummyTime={startTummyTime} stopTummyTime={stopTummyTime} />
    </section>
  )
})
