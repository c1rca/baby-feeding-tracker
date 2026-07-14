import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { diaperKindsLabel, entryDiaperKinds, formatTimelineTimestamp, timelineFeedLabel } from '../../domain/trackerDomain'
import type { Entry } from '../../types'
import { DeleteConfirmation } from './DeleteConfirmation'
import { EntryEditPanel, FeedMetricChips } from './EntryEditPanel'
import type { TimelineActions } from './timelineTypes'
import { openMenu } from './timelineUtils'

export function EntryTimelineItem({ entry, index, actions }: { entry: Entry; index: number; actions: TimelineActions }) {
  const isEditing = actions.editing?.id === entry.id
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
            <FeedMetricChips entry={entry} />
            <span className="timeline-age">{formatDistanceToNow(entry.startedAt, { addSuffix: true })}</span>
          </div>
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
