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

export function Timeline({ entries, diapers, medicines, editing, editingDiaper, editingMedicine, openEntryMenuId, confirmingDeleteEntryId, setEntries, setEditing, setEditingDiaper, setEditingMedicine, setOpenEntryMenuId, setConfirmingDeleteEntryId, resumeEntry, deleteEntry, deleteDiaper, deleteMedicine, startMedicineEdit, toggleEditingDiaperKind, toggleEditingEntryDiaperKind, saveDiaperEdit, saveMedicineEdit, showToast }: TimelineProps) {
  return (
    <section className="card timeline-card"><div className="section-heading"><h2>Timeline</h2><span className="muted">Latest first</span></div>{entries.length === 0 && diapers.length === 0 && medicines.length === 0 ? <p className="muted">No feeds yet. Start with left/right, quick bottle, diaper, or medicine log.</p> : <ul className="timeline">{[
        ...entries.map((entry) => ({ kind: 'feed' as const, time: entry.endedAt, entry })),
        ...diapers.map((diaper) => ({ kind: 'diaper' as const, time: diaper.at, diaper })),
        ...medicines.map((medicine) => ({ kind: 'medicine' as const, time: medicine.at, medicine })),
      ].sort((a, b) => b.time - a.time).map((item, index) => {
        if (item.kind === 'medicine') {
          const medicine = item.medicine
          const isEditingMedicine = editingMedicine?.id === medicine.id
          const menuOpen = openEntryMenuId === medicine.id
          const confirmingDelete = confirmingDeleteEntryId === medicine.id
          return <li key={medicine.id} className={`timeline-item timeline-medicine timeline-medicine-${medicine.kind} ${menuOpen ? 'menu-open' : ''}`}><div className="timeline-row"><div className="timeline-main"><div className="timeline-head"><strong>{formatTime(medicine.at)}</strong><span className={`badge badge-medicine badge-medicine-${medicine.kind}`}><Pill size={13} /> {medicineLabel(medicine.kind)}</span></div><span className="timeline-age">{formatDistanceToNow(medicine.at, { addSuffix: true })}</span></div>{!isEditingMedicine ? <div className="entry-action-wrap"><button type="button" className="entry-action-trigger" aria-label="Medicine actions" aria-expanded={menuOpen} onClick={() => { setOpenEntryMenuId(menuOpen ? null : medicine.id); setConfirmingDeleteEntryId(null) }}><MoreHorizontal size={17} /></button>{menuOpen ? <div className="entry-menu" role="menu"><button type="button" role="menuitem" aria-label="Edit medicine" onClick={() => startMedicineEdit(medicine)}><Pencil size={15} /> Edit</button><button type="button" role="menuitem" aria-label="Delete medicine" className="danger-menu" onClick={() => setConfirmingDeleteEntryId(medicine.id)}><Trash2 size={15} /> Delete</button>{confirmingDelete ? <div className="delete-confirm"><span>Are you sure?</span><button type="button" role="menuitem" aria-label="Confirm delete medicine" className="confirm-delete" onClick={() => deleteMedicine(medicine)}>Confirm delete</button></div> : null}</div> : null}</div> : null}</div>{isEditingMedicine ? <div className="edit-panel"><div className="diaper-edit-panel" role="group" aria-label="Edit medicine kind">{(['tylenol', 'motrin'] as MedicineKind[]).map((kind) => { const selected = editingMedicine.kind === kind; return <button key={kind} type="button" className={`medicine-chip ${selected ? 'selected' : ''}`} aria-label={`Select ${medicineLabel(kind)}`} aria-pressed={selected} onClick={() => setEditingMedicine({ ...editingMedicine, kind })}><Pill size={14} /> {medicineLabel(kind)}</button> })}</div><label>Medicine time<input aria-label="Medicine time" value={editingMedicine.time} onChange={(event) => setEditingMedicine({ ...editingMedicine, time: event.target.value })} placeholder="9:15 AM" /></label><div className="row"><button className="primary" aria-label="Save medicine" onClick={() => saveMedicineEdit(medicine)}><Save size={15} /> Save</button><button onClick={() => setEditingMedicine(null)}>Cancel</button></div></div> : null}</li>
        }
        if (item.kind === 'diaper') {
          const diaper = item.diaper
          const kinds = diaperKinds(diaper)
          const isEditingDiaper = editingDiaper?.id === diaper.id
          const menuOpen = openEntryMenuId === diaper.id
          const confirmingDelete = confirmingDeleteEntryId === diaper.id
          return <li key={diaper.id} className={`timeline-item timeline-diaper timeline-diaper-${kinds.includes('stool') ? 'stool' : 'wet'} ${menuOpen ? 'menu-open' : ''}`}><div className="timeline-row"><div className="timeline-main"><div className="timeline-head"><strong>{formatTime(diaper.at)}</strong><span className={`badge badge-diaper ${kinds.includes('stool') ? 'badge-diaper-stool' : ''}`}>{diaperEventLabel(diaper)}</span></div><span className="timeline-age">{formatDistanceToNow(diaper.at, { addSuffix: true })}</span></div>{!isEditingDiaper ? <div className="entry-action-wrap"><button type="button" className="entry-action-trigger" aria-label="Diaper actions" aria-expanded={menuOpen} onClick={() => { setOpenEntryMenuId(menuOpen ? null : diaper.id); setConfirmingDeleteEntryId(null) }}><MoreHorizontal size={17} /></button>{menuOpen ? <div className="entry-menu" role="menu"><button type="button" role="menuitem" aria-label="Edit diaper" onClick={() => { setEditingDiaper({ id: diaper.id, kinds }); setOpenEntryMenuId(null) }}><Pencil size={15} /> Edit</button><button type="button" role="menuitem" aria-label="Delete diaper" className="danger-menu" onClick={() => setConfirmingDeleteEntryId(diaper.id)}><Trash2 size={15} /> Delete</button>{confirmingDelete ? <div className="delete-confirm"><span>Are you sure?</span><button type="button" role="menuitem" aria-label="Confirm delete diaper" className="confirm-delete" onClick={() => deleteDiaper(diaper)}>Confirm delete</button></div> : null}</div> : null}</div> : null}</div>{isEditingDiaper ? <div className="edit-panel diaper-edit-panel" role="group" aria-label="Edit diaper">{(['wet', 'stool'] as DiaperKind[]).map((kind) => { const selected = editingDiaper.kinds.includes(kind); return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={`Select ${kind} diaper`} aria-pressed={selected} onClick={() => toggleEditingDiaperKind(kind)}>{diaperLabel(kind)}</button> })}<div className="row"><button type="button" className="primary" aria-label="Save diaper" onClick={() => saveDiaperEdit(diaper)}><Save size={15} /> Save</button><button type="button" onClick={() => setEditingDiaper(null)}>Cancel</button></div></div> : null}</li>
        }
        const e = item.entry
        const showInlineResume = index < 2
        const isEditing = editing?.id === e.id
        const total = e.leftSeconds + e.rightSeconds
        const hasBottle = Boolean(e.bottleOunces)
        const menuOpen = openEntryMenuId === e.id
        const confirmingDelete = confirmingDeleteEntryId === e.id
        return (
          <li key={e.id} className={`timeline-item timeline-${e.type} ${menuOpen ? 'menu-open' : ''}`}>
            <div className="timeline-row">
              <div className="timeline-main">
                <div className="timeline-head">
                  <strong>{formatTime(e.startedAt)}</strong>
                  <span className={`badge badge-${e.type}`}>{timelineFeedLabel(e)}</span>
                  {entryDiaperKinds(e).length ? <span className="badge badge-diaper">{diaperKindsLabel(entryDiaperKinds(e))}</span> : null}
                  <div className="timeline-metrics" aria-label="Feed details">
                    {e.leftSeconds > 0 && e.rightSeconds > 0 ? <span className="metric primary-metric">{formatDuration(total)} total</span> : null}
                    {e.leftSeconds > 0 ? <span className={`metric side-metric ${e.rightSeconds === 0 ? 'primary-metric' : ''}`}>{e.rightSeconds > 0 ? `Left: ${formatDuration(e.leftSeconds)}` : formatDuration(e.leftSeconds)}</span> : null}
                    {e.rightSeconds > 0 ? <span className={`metric side-metric ${e.leftSeconds === 0 ? 'primary-metric' : ''}`}>{e.leftSeconds > 0 ? `Right: ${formatDuration(e.rightSeconds)}` : formatDuration(e.rightSeconds)}</span> : null}
                    {hasBottle ? <span className={`metric bottle-metric ${total === 0 ? 'primary-metric' : ''}`}>{e.bottleOunces?.toFixed(1)} oz</span> : null}
                  </div>
                </div>
                <span className="timeline-age">{formatDistanceToNow(e.endedAt, { addSuffix: true })}</span>
                {e.note ? <div className="note-chip">📝 {e.note}</div> : null}
              </div>
              {!isEditing ? (
                <div className="entry-action-wrap">
                  {showInlineResume ? <button type="button" className="inline-resume" aria-label="Resume recent entry" onClick={() => resumeEntry(e)}>Resume</button> : null}
                  <button type="button" className="entry-action-trigger" aria-label="Entry actions" aria-expanded={menuOpen} onClick={() => { setOpenEntryMenuId(menuOpen ? null : e.id); setConfirmingDeleteEntryId(null) }}><MoreHorizontal size={17} /></button>
                  {menuOpen ? (
                    <div className="entry-menu" role="menu">
                      <button type="button" role="menuitem" aria-label="Edit entry" onClick={() => { setEditing({ id: e.id, leftMinutes: String(Math.round(e.leftSeconds / 60)), rightMinutes: String(Math.round(e.rightSeconds / 60)), bottleOunces: e.bottleOunces ? String(e.bottleOunces) : '', note: e.note ?? '', diaperKinds: entryDiaperKinds(e) }); setOpenEntryMenuId(null) }}><Pencil size={15} /> Edit</button>
                      <button type="button" role="menuitem" aria-label="Resume session" onClick={() => resumeEntry(e)}><RotateCcw size={15} /> Resume</button>
                      <button type="button" role="menuitem" aria-label="Delete entry" className="danger-menu" onClick={() => setConfirmingDeleteEntryId(e.id)}><Trash2 size={15} /> Delete</button>
                      {confirmingDelete ? <div className="delete-confirm"><span>Are you sure?</span><button type="button" role="menuitem" aria-label="Confirm delete entry" className="confirm-delete" onClick={() => deleteEntry(e)}>Confirm delete</button></div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {isEditing ? (
              <div className="edit-panel">
                <div className="manual-grid">
                  <label>Left minutes<input inputMode="decimal" value={editing.leftMinutes} onChange={(event) => setEditing({ ...editing, leftMinutes: event.target.value })} /></label>
                  <label>Right minutes<input inputMode="decimal" value={editing.rightMinutes} onChange={(event) => setEditing({ ...editing, rightMinutes: event.target.value })} /></label>
                  <label>Bottle ounces<input inputMode="decimal" value={editing.bottleOunces} onChange={(event) => setEditing({ ...editing, bottleOunces: event.target.value })} placeholder="e.g. 2.5" /></label>
                  <label>Note<input value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} /></label>
                </div>
                <div className="diaper-edit-panel" role="group" aria-label="Edit entry diapers">
                  <span className="diaper-panel-label">Diaper</span>
                  {(['wet', 'stool'] as DiaperKind[]).map((kind) => {
                    const selected = editing.diaperKinds.includes(kind)
                    return <button key={kind} type="button" className={`diaper-chip ${selected ? 'selected' : ''}`} aria-label={`${selected ? 'Remove' : 'Add'} ${kind} diaper from entry`} aria-pressed={selected} onClick={() => toggleEditingEntryDiaperKind(kind)}>{diaperLabel(kind)}</button>
                  })}
                </div>
                <div className="row">
                  <button className="primary" onClick={() => {
                    const leftSeconds = Math.max(0, Math.round((Number(editing.leftMinutes) || 0) * 60))
                    const rightSeconds = Math.max(0, Math.round((Number(editing.rightMinutes) || 0) * 60))
                    const bottle = Number(editing.bottleOunces) > 0 ? Number(editing.bottleOunces) : null
                    const type: FeedType = bottle && leftSeconds + rightSeconds > 0 ? 'mixed' : bottle ? 'bottle' : 'breast'
                    setEntries((prev) => prev.map((entry) => entry.id === e.id ? { ...entry, type, leftSeconds, rightSeconds, bottleOunces: bottle, note: editing.note.trim(), diaperKinds: editing.diaperKinds } : entry).sort((a, b) => b.endedAt - a.endedAt))
                    setEditing(null)
                    showToast('Entry updated')
                  }}><Save size={15} /> Save</button>
                  <button onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          </li>
        )
      })}</ul>}</section>
  )
}
