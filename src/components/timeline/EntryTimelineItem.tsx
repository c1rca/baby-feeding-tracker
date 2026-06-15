import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Pencil, RotateCcw, Save, Trash2 } from 'lucide-react'
import { formatDuration } from '../../domain/feedingUtils'
import { diaperKindsLabel, diaperLabel, entryDiaperKinds, formatTimelineTimestamp, timelineFeedLabel } from '../../domain/trackerDomain'
import type { EditingState, Entry, FeedType } from '../../types'
import { DeleteConfirmation } from './DeleteConfirmation'
import type { TimelineActions } from './timelineTypes'
import { DIAPER_KINDS, openMenu } from './timelineUtils'

export function EntryTimelineItem({ entry, index, actions }: { entry: Entry; index: number; actions: TimelineActions }) {
  const isEditing = actions.editing?.id === entry.id
  const total = entry.leftSeconds + entry.rightSeconds
  const hasBottle = Boolean(entry.bottleOunces)
  const menuOpen = actions.openEntryMenuId === entry.id
  const confirmingDelete = actions.confirmingDeleteEntryId === entry.id
  const entryDiapers = entryDiaperKinds(entry)
  const timestamp = formatTimelineTimestamp(entry.startedAt)

  return (
    <li className={`timeline-item timeline-${entry.type} ${menuOpen ? 'menu-open' : ''}`}>
      <div className="timeline-row">
        <div className="timeline-main">
          <div className="timeline-head">
            <strong>{timestamp.primary}</strong>
            <span className={`badge badge-${entry.type}`}>{timelineFeedLabel(entry)}</span>
            {entryDiapers.length ? <span className="badge badge-diaper">{diaperKindsLabel(entryDiapers)}</span> : null}
            <div className="timeline-metrics" aria-label="Feed details">
              {entry.leftSeconds > 0 && entry.rightSeconds > 0 ? <span className="metric primary-metric">{formatDuration(total)} total</span> : null}
              {entry.leftSeconds > 0 ? <span className={`metric side-metric ${entry.rightSeconds === 0 ? 'primary-metric' : ''}`}>{entry.rightSeconds > 0 ? `Left: ${formatDuration(entry.leftSeconds)}` : formatDuration(entry.leftSeconds)}</span> : null}
              {entry.rightSeconds > 0 ? <span className={`metric side-metric ${entry.leftSeconds === 0 ? 'primary-metric' : ''}`}>{entry.leftSeconds > 0 ? `Right: ${formatDuration(entry.rightSeconds)}` : formatDuration(entry.rightSeconds)}</span> : null}
              {hasBottle ? <span className={`metric bottle-metric ${total === 0 ? 'primary-metric' : ''}`}>{entry.bottleOunces?.toFixed(1)} oz</span> : null}
            </div>
          </div>
          <span className="timeline-age">{formatDistanceToNow(entry.startedAt, { addSuffix: true })}</span>
          {entry.note ? <div className="note-chip">📝 {entry.note}</div> : null}
        </div>
        {!isEditing ? (
          <div className="entry-action-wrap">
            {index < 2 ? <button type="button" className="inline-resume" aria-label="Resume recent entry" onClick={() => actions.resumeEntry(entry)}>Resume</button> : null}
            <button type="button" className="entry-action-trigger" aria-label="Entry actions" aria-expanded={menuOpen} onClick={() => openMenu(entry.id, menuOpen, actions)}><MoreHorizontal size={17} /></button>
            {menuOpen ? (
              <div className="entry-menu" role="menu">
                <button type="button" role="menuitem" aria-label="Edit entry" onClick={() => { actions.setEditing({ id: entry.id, leftMinutes: String(Math.round(entry.leftSeconds / 60)), rightMinutes: String(Math.round(entry.rightSeconds / 60)), bottleOunces: entry.bottleOunces ? String(entry.bottleOunces) : '', note: entry.note ?? '', diaperKinds: entryDiapers }); actions.setOpenEntryMenuId(null) }}><Pencil size={15} /> Edit</button>
                <button type="button" role="menuitem" aria-label="Resume session" onClick={() => actions.resumeEntry(entry)}><RotateCcw size={15} /> Resume</button>
                <button type="button" role="menuitem" aria-label="Delete entry" className="danger-menu" onClick={() => actions.setConfirmingDeleteEntryId(entry.id)}><Trash2 size={15} /> Delete</button>
                {confirmingDelete ? <DeleteConfirmation label="Confirm delete entry" onConfirm={() => actions.deleteEntry(entry)} /> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {isEditing && actions.editing ? <EntryEditPanel entry={entry} editing={actions.editing} actions={actions} /> : null}
    </li>
  )
}

function EntryEditPanel({ entry, editing, actions }: { entry: Entry; editing: NonNullable<EditingState>; actions: TimelineActions }) {
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
  const durationMs = (leftSeconds + rightSeconds) * 1000
  actions.setEntries((prev) => prev.map((current) => current.id === entry.id ? { ...current, type, leftSeconds, rightSeconds, bottleOunces: bottle, note: editing.note.trim(), diaperKinds: editing.diaperKinds, endedAt: current.startedAt + durationMs } : current).sort((a, b) => b.endedAt - a.endedAt))
  actions.setEditing(null)
  actions.showToast('Entry updated')
}
