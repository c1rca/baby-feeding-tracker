import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'

type ManualFeedModalProps = Pick<TrackerModalsProps, 'manualDraft' | 'setManualDraft' | 'setManualOpen' | 'saveManualFeed'>

export function ManualFeedModal({ manualDraft, setManualDraft, setManualOpen, saveManualFeed }: ManualFeedModalProps) {
  return (
    <ModalFrame label="Add missed feed" className="manual-card" onClose={() => setManualOpen(false)}>
      <div className="hero-top"><h2>Add Missed Feed</h2><span className="pill">Manual</span></div>
      <div className="manual-grid">
        <label>Feed date<input type="date" value={manualDraft.date} onChange={(event) => setManualDraft({ ...manualDraft, date: event.target.value })} /></label>
        <label>Feed start time<input type="time" value={manualDraft.time} onChange={(event) => setManualDraft({ ...manualDraft, time: event.target.value })} /></label>
        <label>Manual left minutes<input inputMode="decimal" value={manualDraft.leftMinutes} onChange={(event) => setManualDraft({ ...manualDraft, leftMinutes: event.target.value })} placeholder="0" /></label>
        <label>Manual right minutes<input inputMode="decimal" value={manualDraft.rightMinutes} onChange={(event) => setManualDraft({ ...manualDraft, rightMinutes: event.target.value })} placeholder="0" /></label>
        <label>Manual bottle ounces<input inputMode="decimal" value={manualDraft.bottleOunces} onChange={(event) => setManualDraft({ ...manualDraft, bottleOunces: event.target.value })} placeholder="0.0" /></label>
        <label>Manual note<input value={manualDraft.note} onChange={(event) => setManualDraft({ ...manualDraft, note: event.target.value })} placeholder="optional" /></label>
      </div>
      <div className="row"><button className="primary" onClick={saveManualFeed}>Save missed feed</button><button onClick={() => setManualOpen(false)}>Cancel</button></div>
    </ModalFrame>
  )
}
