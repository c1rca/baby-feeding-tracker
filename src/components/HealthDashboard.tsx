import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { CalendarClock, Check, Plus, Syringe, Trash2, Trophy, X } from 'lucide-react'
import { buildHealthOverview, healthRecordKindLabel, HEALTH_RECORD_KINDS, type ScheduleRow } from '../domain/healthRecords'
import { makeId } from '../domain/trackerDomain'
import { formatDateInput, parseDateAndTime } from '../domain/time'
import type { HealthRecord, HealthRecordKind } from '../types'

type HealthDashboardProps = {
  healthRecords: HealthRecord[]
  setHealthRecords: Dispatch<SetStateAction<HealthRecord[]>>
  babyDob: string
  now: number
}

type HealthDraft = { kind: HealthRecordKind; name: string; date: string; time: string; note: string }

const emptyDraft = (now: number): HealthDraft => ({ kind: 'appointment', name: '', date: formatDateInput(now), time: '09:00', note: '' })
const formatDay = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const formatDayTime = (ms: number) => `${formatDay(ms)}, ${new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
const ageLabel = (months: number) => (months === 0 ? 'Birth' : `${months} mo`)

function ScheduleList({ rows, emptyText, onLog, onUndo }: { rows: ScheduleRow[]; emptyText: string; onLog: (row: ScheduleRow) => void; onUndo: (row: ScheduleRow) => void }) {
  if (!rows.length) return <p className="muted">{emptyText}</p>
  return (
    <ul className="health-schedule">
      {rows.map((row) => (
        <li key={row.key} className={`health-schedule-row is-${row.status}`}>
          <div className="health-schedule-main">
            <strong>{row.name}</strong>
            <small>{[row.detail, ageLabel(row.ageMonths), row.record ? `logged ${formatDay(row.record.at)}` : null].filter(Boolean).join(' · ')}</small>
          </div>
          <span className={`health-status health-status-${row.status}`}>{row.status === 'done' ? 'Done' : row.status === 'due' ? 'Due' : 'Upcoming'}</span>
          {row.record
            ? <button type="button" className="icon-plain" aria-label={`Undo ${row.name}`} onClick={() => onUndo(row)}><X size={15} /></button>
            : <button type="button" className="icon-plain" aria-label={`Mark ${row.name} done`} onClick={() => onLog(row)}><Check size={15} /></button>}
        </li>
      ))}
    </ul>
  )
}

export function HealthDashboard({ healthRecords, setHealthRecords, babyDob, now }: HealthDashboardProps) {
  const [draft, setDraft] = useState<HealthDraft>(() => emptyDraft(now))
  const [formOpen, setFormOpen] = useState(false)
  // Reference schedules run to 24 months, so past-age rows stay visible but
  // collapse behind a toggle once the list gets long.
  const [showAllVaccines, setShowAllVaccines] = useState(false)
  const overview = useMemo(() => buildHealthOverview(healthRecords, babyDob, now), [healthRecords, babyDob, now])

  const addRecord = (record: HealthRecord) => setHealthRecords((current) => [record, ...current.filter((item) => item.id !== record.id)])
  const removeRecord = (id: string) => setHealthRecords((current) => current.filter((item) => item.id !== id))

  const logScheduled = (row: ScheduleRow, kind: HealthRecordKind) =>
    addRecord({ id: makeId(), kind, name: row.name, at: now, note: row.detail, completed: true })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const name = draft.name.trim()
    if (!name) return
    const at = draft.kind === 'appointment'
      ? parseDateAndTime(draft.date, draft.time)
      : parseDateAndTime(draft.date, '12:00')
    if (at === null) return
    addRecord({ id: makeId(), kind: draft.kind, name, at, note: draft.note.trim() || undefined, completed: draft.kind !== 'appointment' })
    setDraft(emptyDraft(now))
    setFormOpen(false)
  }

  const visibleVaccines = showAllVaccines ? overview.vaccines : overview.vaccines.filter((row) => row.status !== 'upcoming')

  return (
    <section className="health-section" aria-label="Health records">
      <div className="card health-hero">
        <div className="health-hero-copy">
          <h2>Health record</h2>
          <p className="muted">Immunisations, milestones, and appointments. Schedules are a reminder aid — your pediatrician sets the real one.</p>
        </div>
        <button type="button" className="primary" onClick={() => setFormOpen((open) => !open)}><Plus size={15} /> Add record</button>
      </div>

      {formOpen ? (
        <form className="card health-form" aria-label="Add health record" onSubmit={submit}>
          <div className="care-segmented" role="group" aria-label="Record type">
            {HEALTH_RECORD_KINDS.map((kind) => (
              <button key={kind} type="button" aria-pressed={draft.kind === kind} className={draft.kind === kind ? 'is-active' : ''} onClick={() => setDraft((current) => ({ ...current, kind }))}>{healthRecordKindLabel(kind)}</button>
            ))}
          </div>
          <div className="manual-grid">
            <label>Name<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={draft.kind === 'appointment' ? 'e.g. 4-month checkup' : draft.kind === 'vaccine' ? 'e.g. DTaP' : 'e.g. Rolls over'} /></label>
            <label>Date<input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
            {draft.kind === 'appointment' ? <label>Time<input type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} /></label> : null}
            <label>Note<input value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="optional" /></label>
          </div>
          <div className="row"><button type="submit" className="primary">Save record</button><button type="button" onClick={() => setFormOpen(false)}>Cancel</button></div>
        </form>
      ) : null}

      <article className="card health-card" aria-label="Appointments">
        <div className="section-heading"><h3><CalendarClock size={16} /> Appointments</h3></div>
        {overview.upcomingAppointments.length ? (
          <ul className="health-list">
            {overview.upcomingAppointments.map((record) => (
              <li key={record.id}>
                <div><strong>{record.name}</strong><small>{formatDayTime(record.at)}{record.note ? ` · ${record.note}` : ''}</small></div>
                <button type="button" className="icon-plain" aria-label={`Delete ${record.name}`} onClick={() => removeRecord(record.id)}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No upcoming appointments.</p>}
        {overview.pastAppointments.length ? <details className="health-past"><summary>{overview.pastAppointments.length} past</summary><ul className="health-list">{overview.pastAppointments.map((record) => (
          <li key={record.id}>
            <div><strong>{record.name}</strong><small>{formatDayTime(record.at)}</small></div>
            <button type="button" className="icon-plain" aria-label={`Delete ${record.name}`} onClick={() => removeRecord(record.id)}><Trash2 size={15} /></button>
          </li>
        ))}</ul></details> : null}
      </article>

      <article className="card health-card" aria-label="Immunisations">
        <div className="section-heading">
          <h3><Syringe size={16} /> Immunisations</h3>
          <span className="muted">{overview.vaccinesDue.length ? `${overview.vaccinesDue.length} due` : 'Up to date'}</span>
        </div>
        <ScheduleList
          rows={visibleVaccines}
          emptyText="Nothing due yet on the routine schedule."
          onLog={(row) => logScheduled(row, 'vaccine')}
          onUndo={(row) => row.record && removeRecord(row.record.id)}
        />
        <button type="button" className="care-secondary-action" onClick={() => setShowAllVaccines((shown) => !shown)}>{showAllVaccines ? 'Hide later doses' : 'Show the full schedule'}</button>
      </article>

      <article className="card health-card" aria-label="Milestones">
        <div className="section-heading">
          <h3><Trophy size={16} /> Milestones</h3>
          <span className="muted">{overview.milestones.filter((row) => row.status === 'done').length} logged</span>
        </div>
        <p className="muted health-milestone-note">Typical ages only. Babies vary enormously — this is a prompt to log, not an assessment.</p>
        <ScheduleList
          rows={overview.milestones.filter((row) => row.status !== 'upcoming')}
          emptyText="Milestone prompts appear as your baby grows."
          onLog={(row) => logScheduled(row, 'milestone')}
          onUndo={(row) => row.record && removeRecord(row.record.id)}
        />
        {overview.customRecords.length ? <ul className="health-list health-custom">{overview.customRecords.map((record) => (
          <li key={record.id}>
            <div><strong>{record.name}</strong><small>{healthRecordKindLabel(record.kind)} · {formatDay(record.at)}{record.note ? ` · ${record.note}` : ''}</small></div>
            <button type="button" className="icon-plain" aria-label={`Delete ${record.name}`} onClick={() => removeRecord(record.id)}><Trash2 size={15} /></button>
          </li>
        ))}</ul> : null}
      </article>
    </section>
  )
}
