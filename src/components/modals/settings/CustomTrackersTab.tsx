import { useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { Archive, ArchiveRestore, Check, ChevronDown, Pencil, Plus, Sparkles } from 'lucide-react'
import {
  CUSTOM_TRACKER_HUES, CUSTOM_TRACKER_ICONS, DEFAULT_CUSTOM_HUE, DEFAULT_CUSTOM_ICON,
  activeCustomTrackers, canAddCustomTracker, customTrackerHueToken,
} from '../../../domain/customTrackers'
import { CUSTOM_TRACKER_LIMIT, type CustomTracker, type CustomTrackerGoal, type CustomTrackerReminder } from '../../../types'
import { reminderSummary } from '../../../domain/customTrackerReminders'
import { CustomTrackerIcon } from '../../customTrackerIcons'
import { CareNeedRow, previewCustomNeed } from '../../careNeeds'

type GoalKind = CustomTrackerGoal['kind']
type ReminderKind = 'off' | 'interval' | 'timeOfDay'

const goalOf = (kind: GoalKind, amount: number): CustomTrackerGoal =>
  kind === 'once' ? { kind: 'once' } : kind === 'count' ? { kind: 'count', target: Math.max(1, amount) } : { kind: 'duration', targetMinutes: Math.max(1, amount) }

const reminderOf = (kind: ReminderKind, everyHours: number, atMinutes: number): CustomTrackerReminder | null =>
  kind === 'off' ? null : kind === 'interval' ? { kind: 'interval', everyHours } : { kind: 'timeOfDay', atMinutes }

const clockToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number)
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 9 * 60
}
const minutesToClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const goalSummary = (goal: CustomTrackerGoal) =>
  goal.kind === 'once' ? 'Once a day' : goal.kind === 'count' ? `${goal.target} times a day` : `${goal.targetMinutes} min a day`

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ct-${Date.now()}-${Math.random().toString(36).slice(2)}`)

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: ReadonlyArray<readonly [T, string]>
  onChange: (value: T) => void
}) {
  return (
    <div className="care-segmented tracker-segmented" role="group" aria-label={label}>
      {options.map(([option, optionLabel]) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>{optionLabel}</button>
      ))}
    </div>
  )
}

function Field({ label, hint, children, stacked = false }: { label: string; hint?: string; children: React.ReactNode; stacked?: boolean }) {
  return (
    <div className={`tracker-field${stacked ? ' is-stacked' : ''}`}>
      <span className="tracker-field-label"><strong>{label}</strong>{hint ? <small>{hint}</small> : null}</span>
      <div className="tracker-field-control">{children}</div>
    </div>
  )
}

export function CustomTrackersSetting({ customTrackers, setCustomTrackers, showToast }: {
  customTrackers: CustomTracker[]
  setCustomTrackers: Dispatch<SetStateAction<CustomTracker[]>>
  showToast: (message: string) => void
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string>(DEFAULT_CUSTOM_ICON)
  const [hue, setHue] = useState<string>(DEFAULT_CUSTOM_HUE)
  const [goalKind, setGoalKind] = useState<GoalKind>('once')
  const [amount, setAmount] = useState(3)
  const [reminderKind, setReminderKind] = useState<ReminderKind>('off')
  const [everyHours, setEveryHours] = useState(4)
  const [atClock, setAtClock] = useState('09:00')
  const [archiveOpen, setArchiveOpen] = useState(false)

  const active = activeCustomTrackers(customTrackers)
  const archived = customTrackers.filter((tracker) => tracker.archivedAt)
  const atLimit = !canAddCustomTracker(customTrackers)

  const resetForm = () => {
    setEditingId(null); setName(''); setIcon(DEFAULT_CUSTOM_ICON); setHue(DEFAULT_CUSTOM_HUE)
    setGoalKind('once'); setAmount(3); setReminderKind('off'); setEveryHours(4); setAtClock('09:00'); setFormOpen(false)
  }

  const startEdit = (tracker: CustomTracker) => {
    setEditingId(tracker.id)
    setName(tracker.name)
    setIcon(tracker.icon || DEFAULT_CUSTOM_ICON)
    setHue(tracker.hue || DEFAULT_CUSTOM_HUE)
    setGoalKind(tracker.goal.kind)
    setAmount(tracker.goal.kind === 'count' ? tracker.goal.target : tracker.goal.kind === 'duration' ? tracker.goal.targetMinutes : 3)
    setReminderKind(tracker.reminder?.kind ?? 'off')
    if (tracker.reminder?.kind === 'interval') setEveryHours(tracker.reminder.everyHours)
    if (tracker.reminder?.kind === 'timeOfDay') setAtClock(minutesToClock(tracker.reminder.atMinutes))
    setFormOpen(true)
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) { showToast('Give the tracker a name'); return }
    const goal = goalOf(goalKind, amount)
    const reminder = reminderOf(reminderKind, everyHours, clockToMinutes(atClock))
    if (editingId) {
      setCustomTrackers((current) => current.map((tracker) => (tracker.id === editingId ? { ...tracker, name: trimmed, icon, hue, goal, reminder, timer: goal.kind === 'duration' } : tracker)))
      showToast(`${trimmed} updated`)
    } else {
      if (atLimit) { showToast(`You can have ${CUSTOM_TRACKER_LIMIT} trackers at a time`); return }
      setCustomTrackers((current) => [...current, { id: newId(), name: trimmed, icon, hue, goal, reminder, timer: goal.kind === 'duration', createdAt: Date.now(), archivedAt: null }])
      showToast(`${trimmed} added to Today's needs`)
    }
    resetForm()
  }

  // Archive rather than delete: the events already logged against this tracker
  // stay in the timeline, and orphaning them would silently rewrite history.
  const archive = (tracker: CustomTracker) => {
    setCustomTrackers((current) => current.map((item) => (item.id === tracker.id ? { ...item, archivedAt: Date.now() } : item)))
    if (editingId === tracker.id) resetForm()
    setArchiveOpen(true)
    showToast(`${tracker.name} archived — its history is kept`)
  }

  const restore = (tracker: CustomTracker) => {
    if (atLimit) { showToast(`Archive one of your ${CUSTOM_TRACKER_LIMIT} trackers before restoring another`); return }
    setCustomTrackers((current) => current.map((item) => (item.id === tracker.id ? { ...item, archivedAt: null } : item)))
    showToast(`${tracker.name} restored`)
  }

  const draft: CustomTracker = {
    id: 'preview', name: name.trim() || 'Your tracker', icon, hue,
    goal: goalOf(goalKind, amount), reminder: reminderOf(reminderKind, everyHours, clockToMinutes(atClock)),
    createdAt: 0, archivedAt: null,
  }

  return (
    <div className="settings-group tracker-settings" aria-label="Custom trackers">
      <div className="tracker-section-head">
        <p className="settings-group-label">Custom trackers</p>
        {active.length > 0 ? <span className="tracker-count" aria-label={`${active.length} of ${CUSTOM_TRACKER_LIMIT} trackers used`}>{active.length}/{CUSTOM_TRACKER_LIMIT}</span> : null}
      </div>
      <p className="settings-lead">Anything else this baby needs — a supplement, physio, time outside. Each one joins Today's needs beside the built-in rows.</p>

      {active.length > 0 ? (
        <div className="settings-card tracker-list">
          {active.map((tracker) => (
            <div key={tracker.id} className={`tracker-row${editingId === tracker.id ? ' is-editing' : ''}`} style={{ '--need-hue': customTrackerHueToken(tracker.hue) } as CSSProperties}>
              <span className="tracker-row-icon" aria-hidden="true"><CustomTrackerIcon icon={tracker.icon} size={17} /></span>
              <span className="tracker-row-text">
                <strong>{tracker.name}</strong>
                <span className="tracker-row-meta">
                  <span className="tracker-chip">{goalSummary(tracker.goal)}</span>
                  {tracker.reminder ? <span className="tracker-chip is-quiet">{reminderSummary(tracker.reminder)}</span> : null}
                </span>
              </span>
              <span className="tracker-row-actions">
                <button type="button" className="tracker-icon-button" aria-label={`Edit ${tracker.name}`} title="Edit" onClick={() => startEdit(tracker)}><Pencil size={15} /></button>
                <button type="button" className="tracker-icon-button" aria-label={`Archive ${tracker.name}`} title="Archive — keeps its history" onClick={() => archive(tracker)}><Archive size={15} /></button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {formOpen ? (
        <div className="settings-card tracker-form" aria-label={editingId ? 'Edit tracker' : 'New tracker'}>
          <div className="tracker-form-head">
            <strong>{editingId ? 'Edit tracker' : 'New tracker'}</strong>
            <small>This is how it will look in Today's needs.</small>
          </div>

          {/* The real row component, from the real descriptor — a preview that
              could drift from the result would be worse than none. */}
          <div className="tracker-preview" aria-label="Preview">
            <CareNeedRow need={previewCustomNeed(draft)} />
          </div>

          <div className="tracker-form-fields">
            <Field label="Name" hint="What you'll see in Today's needs.">
              <input aria-label="Tracker name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Vitamin C" />
            </Field>


            <Field label="Colour" hint="From the app's palette, so it reads in both themes." stacked>
              <div className="tracker-swatches" role="radiogroup" aria-label="Tracker colour">
                {CUSTOM_TRACKER_HUES.map((option) => (
                  <button key={option} type="button" role="radio" aria-checked={hue === option} aria-label={`Colour ${option}`}
                    className={`tracker-swatch${hue === option ? ' is-selected' : ''}`}
                    style={{ '--need-hue': customTrackerHueToken(option) } as CSSProperties}
                    onClick={() => setHue(option)}>{hue === option ? <Check size={13} strokeWidth={3} /> : null}</button>
                ))}
              </div>
            </Field>

            <Field label="Icon" stacked>
              <div className="tracker-icons" role="radiogroup" aria-label="Tracker icon" style={{ '--need-hue': customTrackerHueToken(hue) } as CSSProperties}>
                {CUSTOM_TRACKER_ICONS.map((option) => (
                  <button key={option} type="button" role="radio" aria-checked={icon === option} aria-label={`Icon ${option}`}
                    className={`tracker-icon-option${icon === option ? ' is-selected' : ''}`}
                    onClick={() => setIcon(option)}><CustomTrackerIcon icon={option} size={17} /></button>
                ))}
              </div>
            </Field>

            <Field label="How often" hint="What counts as done for the day.">
              <div className="tracker-control-stack">
                <Segmented label="Goal type" value={goalKind} onChange={setGoalKind}
                  options={[['once', 'Once'], ['count', 'Times'], ['duration', 'Minutes']] as const} />
                {goalKind === 'once' ? null : (
                  <label className="tracker-amount">
                    <input aria-label={goalKind === 'count' ? 'Times per day' : 'Minutes per day'} inputMode="numeric" value={amount}
                      onChange={(event) => setAmount(Math.max(1, Math.min(999, Number(event.target.value.replace(/\D/g, '')) || 1)))} />
                    <span>{goalKind === 'count' ? 'times a day' : 'minutes a day'}</span>
                  </label>
                )}
              </div>
            </Field>

            <Field label="Remind me" hint="Stops once the day's goal is met, and never during quiet hours.">
              <div className="tracker-control-stack">
                <Segmented label="Reminder schedule" value={reminderKind} onChange={setReminderKind}
                  options={[['off', 'Never'], ['interval', 'Every'], ['timeOfDay', 'At']] as const} />
                {reminderKind === 'interval' ? (
                  <label className="tracker-amount">
                    <input aria-label="Remind every hours" inputMode="numeric" value={everyHours}
                      onChange={(event) => setEveryHours(Math.max(1, Math.min(24, Number(event.target.value.replace(/\D/g, '')) || 1)))} />
                    <span>hours since the last log</span>
                  </label>
                ) : null}
                {reminderKind === 'timeOfDay' ? (
                  <label className="tracker-amount is-time">
                    <input aria-label="Remind at time" type="time" value={atClock} onChange={(event) => setAtClock(event.target.value)} />
                    <span>each day</span>
                  </label>
                ) : null}
              </div>
            </Field>
          </div>

          <div className="tracker-form-actions">
            <button type="button" onClick={resetForm}>Cancel</button>
            <button type="button" className="primary" onClick={submit}>{editingId ? 'Save changes' : 'Add tracker'}</button>
          </div>
        </div>
      ) : active.length === 0 ? (
        <div className="settings-card tracker-empty">
          <span className="tracker-empty-icon" aria-hidden="true"><Sparkles size={20} /></span>
          <strong>Nothing custom yet</strong>
          <p>Add a tracker for anything this baby needs that the app doesn't cover, and it will sit alongside Vitamin D and tummy time.</p>
          <button type="button" className="primary" aria-label="Add custom tracker" onClick={() => { resetForm(); setFormOpen(true) }}><Plus size={15} /> New tracker</button>
        </div>
      ) : (
        <button type="button" className="tracker-add" aria-label="Add custom tracker" disabled={atLimit} onClick={() => { resetForm(); setFormOpen(true) }}>
          <Plus size={16} />
          <span>{atLimit ? `You've used all ${CUSTOM_TRACKER_LIMIT} — archive one to add another` : 'New tracker'}</span>
        </button>
      )}

      {archived.length > 0 ? (
        <div className="tracker-archive">
          <button type="button" className="tracker-archive-toggle" aria-expanded={archiveOpen} onClick={() => setArchiveOpen((open) => !open)}>
            <ChevronDown size={15} className={archiveOpen ? 'is-open' : ''} />
            <span>Archived</span>
            <span className="tracker-count is-quiet">{archived.length}</span>
          </button>
          {archiveOpen ? (
            <div className="settings-card tracker-list is-archived">
              <p className="tracker-archive-note">Hidden from Today's needs. Everything already logged against them is kept.</p>
              {archived.map((tracker) => (
                <div key={tracker.id} className="tracker-row" style={{ '--need-hue': customTrackerHueToken(tracker.hue) } as CSSProperties}>
                  <span className="tracker-row-icon" aria-hidden="true"><CustomTrackerIcon icon={tracker.icon} size={17} /></span>
                  <span className="tracker-row-text">
                    <strong>{tracker.name}</strong>
                    <span className="tracker-row-meta"><span className="tracker-chip">{goalSummary(tracker.goal)}</span></span>
                  </span>
                  <button type="button" className="tracker-restore" aria-label={`Restore ${tracker.name}`} onClick={() => restore(tracker)}><ArchiveRestore size={15} /> Restore</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
