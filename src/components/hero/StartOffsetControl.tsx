import type { HeroPanelProps } from './HeroPanel.types'

type StartOffsetControlProps = Pick<
  HeroPanelProps,
  | 'session'
  | 'startOffsetOpen'
  | 'startInputMode'
  | 'startClockText'
  | 'startMinutesAgo'
  | 'selectedStartMinutesAgo'
  | 'setStartOffsetOpen'
  | 'setStartInputMode'
  | 'setStartClockText'
  | 'setStartMinutesAgo'
>

export function StartOffsetControl({
  session,
  startOffsetOpen,
  startInputMode,
  startClockText,
  startMinutesAgo,
  selectedStartMinutesAgo,
  setStartOffsetOpen,
  setStartInputMode,
  setStartClockText,
  setStartMinutesAgo,
}: StartOffsetControlProps) {
  if (session) return null

  return (
    <div className={`start-offset-shell ${startOffsetOpen ? 'expanded' : ''}`}>
      <button type="button" className="start-offset-toggle" aria-label="Adjust start time" aria-expanded={startOffsetOpen} onClick={() => setStartOffsetOpen((open) => !open)}>
        <span>Start time</span>
        <strong>{selectedStartMinutesAgo === 0 ? 'Now' : `${selectedStartMinutesAgo} min ago`}</strong>
      </button>
      {startOffsetOpen ? (
        <div className="start-offset-panel" aria-label="Session start offset">
          <div className="start-tabs" role="tablist" aria-label="Session start input mode">
            <button type="button" role="tab" aria-selected={startInputMode === 'clock'} className={startInputMode === 'clock' ? 'active-tab' : ''} onClick={() => setStartInputMode('clock')}>Clock time</button>
            <button type="button" role="tab" aria-selected={startInputMode === 'minutes'} className={startInputMode === 'minutes' ? 'active-tab' : ''} onClick={() => setStartInputMode('minutes')}>Minutes ago</button>
          </div>
          {startInputMode === 'clock' ? (
            <label>Session start time<input value={startClockText} onChange={(event) => setStartClockText(event.target.value)} placeholder="12:30 PM" /></label>
          ) : (
            <label>Start minutes ago<input inputMode="decimal" value={startMinutesAgo} onChange={(event) => setStartMinutesAgo(event.target.value)} placeholder="5" /></label>
          )}
          <span className="start-offset-summary">{selectedStartMinutesAgo === 0 ? 'Starting now' : `${selectedStartMinutesAgo} min ago`}</span>
        </div>
      ) : null}
    </div>
  )
}
