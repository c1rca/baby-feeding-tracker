import { Save } from 'lucide-react'
import { formatDuration } from '../../domain/feedingUtils'
import { diaperLabel } from '../../domain/trackerDomain'
import type { EditingState, Entry, FeedType } from '../../types'
import type { TimelineActions } from './timelineTypes'
import { DIAPER_KINDS } from './timelineUtils'

export function EntryEditPanel({ entry, editing, actions }: { entry: Entry; editing: NonNullable<EditingState>; actions: TimelineActions }) {
  return (
    <div className="edit-panel">
      <div className="manual-grid">
        <label>Left minutes<input inputMode="decimal" value={editing.leftMinutes} onChange={(event) => actions.setEditing({ ...editing, leftMinutes: event.target.value })} /></label>
        <label>Right minutes<input inputMode="decimal" value={editing.rightMinutes} onChange={(event) => actions.setEditing({ ...editing, rightMinutes: event.target.value })} /></label>
        <label>Bottle ounces<input inputMode="decimal" value={editing.bottleOunces} onChange={(event) => actions.setEditing({ ...editing, bottleOunces: event.target.value })} placeholder="e.g. 2.5" /></label>
        <label>Note<input value={editing.note} onChange={(event) => actions.setEditing({ ...editing, note: event.target.value })} /></label>
      </div>
      <div className="diaper-edit-panel" role="group" aria-label="Edit entry diapers">
        <span className="diaper-panel-label">Diaper</span>
        {DIAPER_KINDS.map((kind) => {
          const selected = editing.diaperKinds.includes(kind)
          return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={`${selected ? 'Remove' : 'Add'} ${kind} diaper from entry`} aria-pressed={selected} onClick={() => actions.toggleEditingEntryDiaperKind(kind)}>{diaperLabel(kind)}</button>
        })}
      </div>
      <div className="row">
        <button className="primary" onClick={() => saveEntryEdit(entry, editing, actions)}><Save size={15} /> Save</button>
        <button onClick={() => actions.setEditing(null)}>Cancel</button>
      </div>
    </div>
  )
}

function saveEntryEdit(entry: Entry, editing: NonNullable<EditingState>, actions: TimelineActions) {
  const leftSeconds = Math.max(0, Math.round((Number(editing.leftMinutes) || 0) * 60))
  const rightSeconds = Math.max(0, Math.round((Number(editing.rightMinutes) || 0) * 60))
  const bottle = Number(editing.bottleOunces) > 0 ? Number(editing.bottleOunces) : null
  const type: FeedType = bottle && leftSeconds + rightSeconds > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
  actions.setEntries((prev) => prev.map((current) => current.id === entry.id ? { ...current, type, leftSeconds, rightSeconds, bottleOunces: bottle, note: editing.note.trim(), diaperKinds: editing.diaperKinds } : current).sort((a, b) => b.endedAt - a.endedAt))
  actions.setEditing(null)
  actions.showToast('Entry updated')
}

export function FeedMetricChips({ entry }: { entry: Entry }) {
  const total = entry.leftSeconds + entry.rightSeconds
  const hasBottle = Boolean(entry.bottleOunces)

  return (
    <div className="timeline-metrics" aria-label="Feed details">
      {entry.leftSeconds > 0 && entry.rightSeconds > 0 ? <span className="metric primary-metric">{formatDuration(total)} total</span> : null}
      {entry.leftSeconds > 0 ? <span className={`metric side-metric ${entry.rightSeconds === 0 ? 'primary-metric' : ''}`}>{entry.rightSeconds > 0 ? `Left: ${formatDuration(entry.leftSeconds)}` : formatDuration(entry.leftSeconds)}</span> : null}
      {entry.rightSeconds > 0 ? <span className={`metric side-metric ${entry.leftSeconds === 0 ? 'primary-metric' : ''}`}>{entry.leftSeconds > 0 ? `Right: ${formatDuration(entry.rightSeconds)}` : formatDuration(entry.rightSeconds)}</span> : null}
      {hasBottle ? <span className={`metric bottle-metric ${total === 0 ? 'primary-metric' : ''}`}>{entry.bottleOunces?.toFixed(1)} oz</span> : null}
    </div>
  )
}
