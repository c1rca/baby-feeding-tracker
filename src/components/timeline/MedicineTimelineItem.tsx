import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Pencil, Pill, Save, Trash2 } from 'lucide-react'
import { formatTimelineTimestamp, medicineLabel } from '../../domain/trackerDomain'
import type { MedicineEvent } from '../../types'
import { DeleteConfirmation } from './DeleteConfirmation'
import type { TimelineActions } from './timelineTypes'
import { MEDICINE_KINDS, openMenu } from './timelineUtils'

export function MedicineTimelineItem({ medicine, actions }: { medicine: MedicineEvent; actions: TimelineActions }) {
  const isEditing = actions.editingMedicine?.id === medicine.id
  const menuOpen = actions.openEntryMenuId === medicine.id
  const confirmingDelete = actions.confirmingDeleteEntryId === medicine.id
  const timestamp = formatTimelineTimestamp(medicine.at)

  return (
    <li className={`timeline-item timeline-medicine timeline-medicine-${medicine.kind} ${menuOpen ? 'menu-open' : ''}`}>
      <div className="timeline-row">
        <div className="timeline-main">
          <div className="timeline-head">
            <strong>{timestamp.primary}</strong>
            <span className={`badge badge-medicine badge-medicine-${medicine.kind}`}><Pill size={13} /> {medicineLabel(medicine.kind)}</span>
            <span className="timeline-age">{formatDistanceToNow(medicine.at, { addSuffix: true })}</span>
          </div>
        </div>
        {!isEditing ? (
          <div className="entry-action-wrap">
            <button type="button" className="entry-action-trigger" aria-label="Medicine actions" aria-expanded={menuOpen} onClick={() => openMenu(medicine.id, menuOpen, actions)}><MoreHorizontal size={17} /></button>
            {menuOpen ? (
              <div className="entry-menu" role="menu">
                <button type="button" role="menuitem" aria-label="Edit medicine" onClick={() => actions.startMedicineEdit(medicine)}><Pencil size={15} /> Edit</button>
                <button type="button" role="menuitem" aria-label="Delete medicine" className="danger-menu" onClick={() => actions.setConfirmingDeleteEntryId(medicine.id)}><Trash2 size={15} /> Delete</button>
                {confirmingDelete ? <DeleteConfirmation label="Confirm delete medicine" onConfirm={() => actions.deleteMedicine(medicine)} /> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {isEditing && actions.editingMedicine ? (
        <div className="edit-panel">
          <div className="diaper-edit-panel" role="group" aria-label="Edit medicine kind">
            {MEDICINE_KINDS.map((kind) => {
              const selected = actions.editingMedicine?.kind === kind
              return <button key={kind} type="button" className={`medicine-chip ${selected ? 'selected' : ''}`} aria-label={`Select ${medicineLabel(kind)}`} aria-pressed={selected} onClick={() => actions.setEditingMedicine({ ...actions.editingMedicine!, kind })}><Pill size={14} /> {medicineLabel(kind)}</button>
            })}
          </div>
          <label>Medicine time<input aria-label="Medicine time" value={actions.editingMedicine.time} onChange={(event) => actions.setEditingMedicine({ ...actions.editingMedicine!, time: event.target.value })} placeholder="9:15 AM" /></label>
          <div className="row"><button className="primary" aria-label="Save medicine" onClick={() => actions.saveMedicineEdit(medicine)}><Save size={15} /> Save</button><button onClick={() => actions.setEditingMedicine(null)}>Cancel</button></div>
        </div>
      ) : null}
    </li>
  )
}
