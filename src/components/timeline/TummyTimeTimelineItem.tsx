import { Dumbbell, Moon, MoreHorizontal, Pencil, Save, Trash2 } from 'lucide-react'
import { formatTimelineTimestamp } from '../../domain/trackerDomain'
import { formatDuration } from '../../domain/feedingUtils'
import { tummyTimeDurationSeconds } from '../../domain/tummyTime'
import type { TummyTimeEvent } from '../../types'
import { DeleteConfirmation } from './DeleteConfirmation'
import type { TimelineActions } from './timelineTypes'
import { formatTimelineAge, openMenu } from './timelineUtils'

export function TummyTimeTimelineItem({ tummyTime, actions }: { tummyTime: TummyTimeEvent; actions: TimelineActions }) {
  const isEditing = actions.editingTummyTime?.id === tummyTime.id
  const menuOpen = actions.openEntryMenuId === tummyTime.id
  const confirmingDelete = actions.confirmingDeleteEntryId === tummyTime.id
  const timestamp = formatTimelineTimestamp(tummyTime.startedAt)
  const duration = formatDuration(tummyTimeDurationSeconds(tummyTime))
  const isSleep = tummyTime.kind === 'sleep'
  const label = isSleep ? 'Sleep' : 'Tummy Time'

  return (
    <li className={`timeline-item timeline-tummy ${menuOpen ? 'menu-open' : ''}`}>
      <div className="timeline-row">
        <div className="timeline-main">
          <div className="timeline-head">
            <strong>{timestamp.primary}</strong>
            <span className={`badge badge-medicine ${isSleep ? 'badge-sleep' : 'badge-tummy'}`}>{isSleep ? <Moon size={13} /> : <Dumbbell size={13} />} {label}</span>
            <span className="metric-chip">{duration}</span>
          </div>
          <span className="timeline-age">{formatTimelineAge(tummyTime.startedAt)}</span>
          {tummyTime.note ? <p className="entry-note">{tummyTime.note}</p> : null}
        </div>
        {!isEditing ? (
          <div className="entry-action-wrap">
            <button type="button" className="entry-action-trigger" aria-label="Tummy Time actions" aria-expanded={menuOpen} onClick={() => openMenu(tummyTime.id, menuOpen, actions)}><MoreHorizontal size={17} /></button>
            {menuOpen ? (
              <div className="entry-menu" role="menu">
                <button type="button" role="menuitem" aria-label="Edit Tummy Time" onClick={() => actions.startTummyTimeEdit(tummyTime)}><Pencil size={15} /> Edit</button>
                <button type="button" role="menuitem" aria-label={`Resume ${label} session`} onClick={() => actions.resumeTummyTime(tummyTime)}>Resume</button>
                <button type="button" role="menuitem" aria-label="Delete Tummy Time" className="danger-menu" onClick={() => actions.setConfirmingDeleteEntryId(tummyTime.id)}><Trash2 size={15} /> Delete</button>
                {confirmingDelete ? <DeleteConfirmation label="Confirm delete Tummy Time" onConfirm={() => actions.deleteTummyTime(tummyTime)} /> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {isEditing && actions.editingTummyTime ? (
        <div className="edit-panel">
          <label>Start time<input aria-label="Tummy Time start time" value={actions.editingTummyTime.startTime} onChange={(event) => actions.setEditingTummyTime({ ...actions.editingTummyTime!, startTime: event.target.value })} placeholder="9:15 AM" /></label>
          <label>End time<input aria-label="Tummy Time end time" value={actions.editingTummyTime.endTime} onChange={(event) => actions.setEditingTummyTime({ ...actions.editingTummyTime!, endTime: event.target.value })} placeholder="9:25 AM" /></label>
          <label>Note<input aria-label="Tummy Time note" value={actions.editingTummyTime.note} onChange={(event) => actions.setEditingTummyTime({ ...actions.editingTummyTime!, note: event.target.value })} placeholder="optional note" /></label>
          <div className="row"><button className="primary" aria-label="Save Tummy Time" onClick={() => actions.saveTummyTimeEdit(tummyTime)}><Save size={15} /> Save</button><button onClick={() => actions.setEditingTummyTime(null)}>Cancel</button></div>
        </div>
      ) : null}
    </li>
  )
}
