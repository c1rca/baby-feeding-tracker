import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, Pencil, Pill, RotateCcw, Save, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { formatDuration } from '../domain/feedingUtils'
import type { DiaperEvent, DiaperKind, EditingDiaperState, EditingMedicineState, EditingState, Entry, FeedType, MedicineEvent, MedicineKind } from '../types'
import { diaperEventLabel, diaperKinds, diaperKindsLabel, diaperLabel, entryDiaperKinds, formatTime, medicineLabel, timelineFeedLabel } from '../domain/trackerDomain'

type TimelineProps = {
  entries: Entry[]
  diapers: DiaperEvent[]
  medicines: MedicineEvent[]
  editing: EditingState
  editingDiaper: EditingDiaperState
  editingMedicine: EditingMedicineState
  openEntryMenuId: string | null
  confirmingDeleteEntryId: string | null
  setEntries: Dispatch<SetStateAction<Entry[]>>
  setEditing: Dispatch<SetStateAction<EditingState>>
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  setEditingMedicine: Dispatch<SetStateAction<EditingMedicineState>>
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
  resumeEntry: (entry: Entry) => void
  deleteEntry: (entry: Entry) => void
  deleteDiaper: (diaper: DiaperEvent) => void
  deleteMedicine: (medicine: MedicineEvent) => void
  startMedicineEdit: (medicine: MedicineEvent) => void
  toggleEditingDiaperKind: (kind: DiaperKind) => void
  toggleEditingEntryDiaperKind: (kind: DiaperKind) => void
  saveDiaperEdit: (diaper: DiaperEvent) => void
  saveMedicineEdit: (medicine: MedicineEvent) => void
  showToast: (message: string) => void
}

type TimelineItem =
  | { kind: 'feed'; time: number; entry: Entry }
  | { kind: 'diaper'; time: number; diaper: DiaperEvent }
  | { kind: 'medicine'; time: number; medicine: MedicineEvent }

type TimelineActions = Pick<
  TimelineProps,
  | 'editing'
  | 'editingDiaper'
  | 'editingMedicine'
  | 'openEntryMenuId'
  | 'confirmingDeleteEntryId'
  | 'setEntries'
  | 'setEditing'
  | 'setEditingDiaper'
  | 'setEditingMedicine'
  | 'setOpenEntryMenuId'
  | 'setConfirmingDeleteEntryId'
  | 'resumeEntry'
  | 'deleteEntry'
  | 'deleteDiaper'
  | 'deleteMedicine'
  | 'startMedicineEdit'
  | 'toggleEditingDiaperKind'
  | 'toggleEditingEntryDiaperKind'
  | 'saveDiaperEdit'
  | 'saveMedicineEdit'
  | 'showToast'
>

const MEDICINE_KINDS: MedicineKind[] = ['tylenol', 'motrin']
const DIAPER_KINDS: DiaperKind[] = ['wet', 'stool']

function timelineItems(entries: Entry[], diapers: DiaperEvent[], medicines: MedicineEvent[]): TimelineItem[] {
  return [
    ...entries.map((entry) => ({ kind: 'feed' as const, time: entry.startedAt, entry })),
    ...diapers.map((diaper) => ({ kind: 'diaper' as const, time: diaper.at, diaper })),
    ...medicines.map((medicine) => ({ kind: 'medicine' as const, time: medicine.at, medicine })),
  ].sort((a, b) => b.time - a.time)
}

function openMenu(id: string, menuOpen: boolean, actions: TimelineActions) {
  actions.setOpenEntryMenuId(menuOpen ? null : id)
  actions.setConfirmingDeleteEntryId(null)
}

function DeleteConfirmation({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <div className="delete-confirm">
      <span>Are you sure?</span>
      <button type="button" role="menuitem" aria-label={label} className="confirm-delete" onClick={onConfirm}>Confirm delete</button>
    </div>
  )
}

function MedicineTimelineItem({ medicine, actions }: { medicine: MedicineEvent; actions: TimelineActions }) {
  const isEditing = actions.editingMedicine?.id === medicine.id
  const menuOpen = actions.openEntryMenuId === medicine.id
  const confirmingDelete = actions.confirmingDeleteEntryId === medicine.id

  return (
    <li className={`timeline-item timeline-medicine timeline-medicine-${medicine.kind} ${menuOpen ? 'menu-open' : ''}`}>
      <div className="timeline-row">
        <div className="timeline-main">
          <div className="timeline-head">
            <strong>{formatTime(medicine.at)}</strong>
            <span className={`badge badge-medicine badge-medicine-${medicine.kind}`}><Pill size={13} /> {medicineLabel(medicine.kind)}</span>
          </div>
          <span className="timeline-age">{formatDistanceToNow(medicine.at, { addSuffix: true })}</span>
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

function DiaperTimelineItem({ diaper, actions }: { diaper: DiaperEvent; actions: TimelineActions }) {
  const kinds = diaperKinds(diaper)
  const isEditing = actions.editingDiaper?.id === diaper.id
  const menuOpen = actions.openEntryMenuId === diaper.id
  const confirmingDelete = actions.confirmingDeleteEntryId === diaper.id

  return (
    <li className={`timeline-item timeline-diaper timeline-diaper-${kinds.includes('stool') ? 'stool' : 'wet'} ${menuOpen ? 'menu-open' : ''}`}>
      <div className="timeline-row">
        <div className="timeline-main">
          <div className="timeline-head"><strong>{formatTime(diaper.at)}</strong><span className={`badge badge-diaper ${kinds.includes('stool') ? 'badge-diaper-stool' : ''}`}>{diaperEventLabel(diaper)}</span></div>
          <span className="timeline-age">{formatDistanceToNow(diaper.at, { addSuffix: true })}</span>
        </div>
        {!isEditing ? (
          <div className="entry-action-wrap">
            <button type="button" className="entry-action-trigger" aria-label="Diaper actions" aria-expanded={menuOpen} onClick={() => openMenu(diaper.id, menuOpen, actions)}><MoreHorizontal size={17} /></button>
            {menuOpen ? (
              <div className="entry-menu" role="menu">
                <button type="button" role="menuitem" aria-label="Edit diaper" onClick={() => { actions.setEditingDiaper({ id: diaper.id, kinds }); actions.setOpenEntryMenuId(null) }}><Pencil size={15} /> Edit</button>
                <button type="button" role="menuitem" aria-label="Delete diaper" className="danger-menu" onClick={() => actions.setConfirmingDeleteEntryId(diaper.id)}><Trash2 size={15} /> Delete</button>
                {confirmingDelete ? <DeleteConfirmation label="Confirm delete diaper" onConfirm={() => actions.deleteDiaper(diaper)} /> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <div className="edit-panel diaper-edit-panel" role="group" aria-label="Edit diaper">
          {DIAPER_KINDS.map((kind) => {
            const selected = Boolean(actions.editingDiaper?.kinds.includes(kind))
            return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={`Select ${kind} diaper`} aria-pressed={selected} onClick={() => actions.toggleEditingDiaperKind(kind)}>{diaperLabel(kind)}</button>
          })}
          <div className="row"><button type="button" className="primary" aria-label="Save diaper" onClick={() => actions.saveDiaperEdit(diaper)}><Save size={15} /> Save</button><button type="button" onClick={() => actions.setEditingDiaper(null)}>Cancel</button></div>
        </div>
      ) : null}
    </li>
  )
}

function EntryTimelineItem({ entry, index, actions }: { entry: Entry; index: number; actions: TimelineActions }) {
  const isEditing = actions.editing?.id === entry.id
  const total = entry.leftSeconds + entry.rightSeconds
  const hasBottle = Boolean(entry.bottleOunces)
  const menuOpen = actions.openEntryMenuId === entry.id
  const confirmingDelete = actions.confirmingDeleteEntryId === entry.id
  const entryDiapers = entryDiaperKinds(entry)

  return (
    <li className={`timeline-item timeline-${entry.type} ${menuOpen ? 'menu-open' : ''}`}>
      <div className="timeline-row">
        <div className="timeline-main">
          <div className="timeline-head">
            <strong>{formatTime(entry.startedAt)}</strong>
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
  actions.setEntries((prev) => prev.map((current) => current.id === entry.id ? { ...current, type, leftSeconds, rightSeconds, bottleOunces: bottle, note: editing.note.trim(), diaperKinds: editing.diaperKinds } : current).sort((a, b) => b.endedAt - a.endedAt))
  actions.setEditing(null)
  actions.showToast('Entry updated')
}

function TimelineList({ items, actions }: { items: TimelineItem[]; actions: TimelineActions }) {
  return (
    <ul className="timeline">
      {items.map((item, index) => {
        if (item.kind === 'medicine') return <MedicineTimelineItem key={item.medicine.id} medicine={item.medicine} actions={actions} />
        if (item.kind === 'diaper') return <DiaperTimelineItem key={item.diaper.id} diaper={item.diaper} actions={actions} />
        return <EntryTimelineItem key={item.entry.id} entry={item.entry} index={index} actions={actions} />
      })}
    </ul>
  )
}

export function Timeline({ entries, diapers, medicines, editing, editingDiaper, editingMedicine, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, startMedicineEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, showToast }: TimelineProps) {
  const items = timelineItems(entries, diapers, medicines)
  const actions: TimelineActions = { editing, editingDiaper, editingMedicine, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, startMedicineEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, showToast }

  return (
    <section className="card timeline-card">
      <div className="section-heading"><h2>Timeline</h2><span className="muted">Latest first</span></div>
      {items.length === 0 ? <p className="muted">No feeds yet. Start with left/right, quick bottle, diaper, or medicine log.</p> : <TimelineList items={items} actions={actions} />}
    </section>
  )
}
