import { forwardRef, useState } from 'react'
import { XCircle } from 'lucide-react'
import { AdditionalOptions } from './hero/AdditionalOptions'
import { HeroActions, HeroCue, LiveSplit, StartOffsetControl, TimerCluster } from './hero/HeroCore'
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
  logDiaperKinds,
  logMedicine,
  logTummyTimeMinutes,
  startTummyTime,
  stopTummyTime,
  startSleep,
  stopSleep,
  pumpSession,
  pumpActiveSeconds,
  startPumping,
  startManualPumping,
  stopPumping,
  clearPumping,
  savePumping,
  pumpCompletionOpen,
  setPumpCompletionOpen,
}, ref) {
  const [clearConfirmingFor, setClearConfirmingFor] = useState<number | null>(null)
  const [careClearConfirming, setCareClearConfirming] = useState(false)
  const clearConfirming = Boolean(session && clearConfirmingFor === session.startedAt)
  const clearCare = () => { if (tummySession) setTummySession(null); if (pumpSession) clearPumping(); setCareClearConfirming(false) }
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
      <TimerCluster session={session} activeSeconds={activeSeconds} activeSide={activeSide} suggestedSide={suggestedSide} tummySession={tummySession} tummyActiveSeconds={tummyActiveSeconds} pumpSession={pumpSession} pumpActiveSeconds={pumpActiveSeconds} pause={pause} resume={resume} />
      {tummySession || pumpSession ? <div className="row hero-actions care-active-actions"><button type="button" className="success end-feed" onClick={tummySession ? stopTummyTime : stopPumping}>{tummySession ? `Stop & Save ${tummySession.kind === 'sleep' ? 'Sleep' : 'Tummy Time'}` : 'Finish & Add Output'}</button><button type="button" className={`active-clear-link ${careClearConfirming ? 'confirming' : ''}`} aria-label={careClearConfirming ? 'Confirm clear active timer' : 'Clear active timer'} onClick={() => careClearConfirming ? clearCare() : setCareClearConfirming(true)}><XCircle size={14} /> {careClearConfirming ? 'Confirm clear' : 'Clear active'}</button></div> : null}
      {!tummySession && !pumpSession ? <div className="hero-micro-meta" aria-label="Feed timing summary">
        <span>{hasLastFeed ? `Last ${lastFeedMetaText}` : lastFeedMetaText}</span>
        {avgGapShortText ? <span>{avgGapShortText}</span> : null}
      </div> : null}
      <LiveSplit session={session} activeSplit={activeSplit} />
      {tummySession ? null : <StartOffsetControl session={session} startOffsetOpen={startOffsetOpen} startInputMode={startInputMode} startClockText={startClockText} startMinutesAgo={startMinutesAgo} selectedStartMinutesAgo={selectedStartMinutesAgo} setStartOffsetOpen={setStartOffsetOpen} setStartInputMode={setStartInputMode} setStartClockText={setStartClockText} setStartMinutesAgo={setStartMinutesAgo} />}
      <HeroActions session={session} tummySession={tummySession} pumpSession={pumpSession} activeSide={activeSide} activeOppositeSide={activeOppositeSide} suggestedSide={suggestedSide} startSession={startSession} switchSide={switchSide} resume={resume} endSession={endSession} clearConfirming={clearConfirming} requestClearSession={requestClearSession} clearIcon={<XCircle size={14} />} />
      <AdditionalOptions session={session} additionalOptionsOpen={additionalOptionsOpen} tummySession={tummySession} setTummySession={setTummySession} setAdditionalOptionsOpen={setAdditionalOptionsOpen} setBottleOpen={setBottleOpen} setManualOpen={setManualOpen} setSession={setSession} logDiaperKinds={logDiaperKinds} logMedicine={logMedicine} logTummyTimeMinutes={logTummyTimeMinutes} startTummyTime={startTummyTime} stopTummyTime={stopTummyTime} startSleep={startSleep} stopSleep={stopSleep} pumpSession={pumpSession} startPumping={startPumping} startManualPumping={startManualPumping} stopPumping={stopPumping} savePumping={savePumping} pumpCompletionOpen={pumpCompletionOpen} setPumpCompletionOpen={setPumpCompletionOpen} />
    </section>
  )
})
