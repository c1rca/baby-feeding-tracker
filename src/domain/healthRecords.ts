// Vaccinations, developmental milestones, and appointments share one shape: a
// named, dated record that is either done or still ahead. Keeping them in one
// collection with a `kind` discriminator means one set of sync/persistence
// plumbing instead of three, and lets the health view sort them together.
import type { HealthRecord, HealthRecordKind } from '../types'

export const HEALTH_RECORD_KINDS: HealthRecordKind[] = ['vaccine', 'milestone', 'appointment']

const KIND_LABELS: Record<HealthRecordKind, string> = {
  vaccine: 'Vaccine',
  milestone: 'Milestone',
  appointment: 'Appointment',
}

export const healthRecordKindLabel = (kind: HealthRecordKind) => KIND_LABELS[kind]
export const isHealthRecordKind = (value: unknown): value is HealthRecordKind =>
  typeof value === 'string' && (HEALTH_RECORD_KINDS as string[]).includes(value)

const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12
const MONTH_MS = AVERAGE_DAYS_PER_MONTH * 86_400_000

export const ageMonthsAt = (babyDob: string, at: number) => {
  const dobMs = new Date(`${babyDob}T12:00:00`).getTime()
  if (!Number.isFinite(dobMs) || !Number.isFinite(at)) return null
  return (at - dobMs) / MONTH_MS
}

export const dateAtAgeMonths = (babyDob: string, months: number) => {
  const dobMs = new Date(`${babyDob}T12:00:00`).getTime()
  return Number.isFinite(dobMs) ? dobMs + months * MONTH_MS : null
}

// The routine US childhood immunisation series through 24 months, as a
// scheduling aid only — a household's actual schedule comes from its
// pediatrician, so nothing here is auto-logged.
export type ScheduledVaccine = { name: string; ageMonths: number; detail?: string }

export const VACCINE_SCHEDULE: ScheduledVaccine[] = [
  { name: 'Hepatitis B', ageMonths: 0, detail: 'Dose 1 — birth' },
  { name: 'Hepatitis B', ageMonths: 2, detail: 'Dose 2' },
  { name: 'DTaP', ageMonths: 2, detail: 'Dose 1' },
  { name: 'Hib', ageMonths: 2, detail: 'Dose 1' },
  { name: 'Polio (IPV)', ageMonths: 2, detail: 'Dose 1' },
  { name: 'Pneumococcal (PCV)', ageMonths: 2, detail: 'Dose 1' },
  { name: 'Rotavirus', ageMonths: 2, detail: 'Dose 1' },
  { name: 'DTaP', ageMonths: 4, detail: 'Dose 2' },
  { name: 'Hib', ageMonths: 4, detail: 'Dose 2' },
  { name: 'Polio (IPV)', ageMonths: 4, detail: 'Dose 2' },
  { name: 'Pneumococcal (PCV)', ageMonths: 4, detail: 'Dose 2' },
  { name: 'Rotavirus', ageMonths: 4, detail: 'Dose 2' },
  { name: 'DTaP', ageMonths: 6, detail: 'Dose 3' },
  { name: 'Pneumococcal (PCV)', ageMonths: 6, detail: 'Dose 3' },
  { name: 'Hepatitis B', ageMonths: 6, detail: 'Dose 3' },
  { name: 'Influenza', ageMonths: 6, detail: 'Annual, from 6 months' },
  { name: 'MMR', ageMonths: 12, detail: 'Dose 1' },
  { name: 'Varicella', ageMonths: 12, detail: 'Dose 1' },
  { name: 'Hepatitis A', ageMonths: 12, detail: 'Dose 1' },
  { name: 'Hib', ageMonths: 12, detail: 'Booster' },
  { name: 'Pneumococcal (PCV)', ageMonths: 12, detail: 'Dose 4' },
  { name: 'DTaP', ageMonths: 15, detail: 'Dose 4' },
  { name: 'Hepatitis A', ageMonths: 18, detail: 'Dose 2' },
]

// Typical age ranges for common milestones. Presented as prompts to log, never
// as a pass/fail assessment — babies vary enormously and this is not a screen.
export type MilestonePrompt = { name: string; ageMonths: number }

export const MILESTONE_PROMPTS: MilestonePrompt[] = [
  { name: 'Smiles socially', ageMonths: 2 },
  { name: 'Holds head steady', ageMonths: 4 },
  { name: 'Rolls over', ageMonths: 4 },
  { name: 'Sits without support', ageMonths: 6 },
  { name: 'Babbles', ageMonths: 6 },
  { name: 'Passes objects hand to hand', ageMonths: 7 },
  { name: 'Crawls', ageMonths: 9 },
  { name: 'Pulls to stand', ageMonths: 9 },
  { name: 'Waves bye-bye', ageMonths: 12 },
  { name: 'First words', ageMonths: 12 },
  { name: 'Walks alone', ageMonths: 15 },
  { name: 'Says several words', ageMonths: 18 },
  { name: 'Runs', ageMonths: 24 },
]

export function sortHealthRecords(records: HealthRecord[]) {
  return [...records].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
}

export function normalizeHealthRecords(value: unknown): HealthRecord[] {
  if (!Array.isArray(value)) return []
  return sortHealthRecords(value
    .map((item): HealthRecord | null => {
      if (!item || typeof item !== 'object') return null
      const raw = item as Partial<HealthRecord>
      const at = Number(raw.at)
      if (!raw.id || typeof raw.name !== 'string' || !raw.name.trim() || !isHealthRecordKind(raw.kind) || !Number.isFinite(at)) return null
      return {
        id: String(raw.id),
        kind: raw.kind,
        name: raw.name.trim(),
        at,
        completed: raw.completed === true,
        note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined,
      }
    })
    .filter((item): item is HealthRecord => Boolean(item)))
}

const matchesRecord = (records: HealthRecord[], kind: HealthRecordKind, name: string, detail?: string) =>
  records.find((record) => record.kind === kind && record.name === name && (!detail || record.note === detail))

export type ScheduleStatus = 'done' | 'due' | 'upcoming'

export type ScheduleRow = {
  key: string
  name: string
  detail?: string
  ageMonths: number
  dueAt: number | null
  status: ScheduleStatus
  record: HealthRecord | null
}

// A scheduled item is `due` once the baby has reached its age and nothing is
// logged for it; `upcoming` before that. Nothing is ever marked overdue —
// schedules slip for ordinary reasons and a red flag would be noise, not care.
function buildSchedule(
  items: Array<{ name: string; ageMonths: number; detail?: string }>,
  kind: HealthRecordKind,
  records: HealthRecord[],
  babyDob: string,
  now: number,
): ScheduleRow[] {
  const currentAge = ageMonthsAt(babyDob, now)
  return items.map((item) => {
    const record = matchesRecord(records, kind, item.name, item.detail) ?? null
    const reached = currentAge !== null && currentAge >= item.ageMonths
    return {
      key: `${kind}:${item.name}:${item.detail ?? item.ageMonths}`,
      name: item.name,
      detail: item.detail,
      ageMonths: item.ageMonths,
      dueAt: dateAtAgeMonths(babyDob, item.ageMonths),
      status: record ? 'done' : reached ? 'due' : 'upcoming',
      record,
    }
  })
}

export const buildVaccineSchedule = (records: HealthRecord[], babyDob: string, now: number) =>
  buildSchedule(VACCINE_SCHEDULE, 'vaccine', records, babyDob, now)

export const buildMilestoneSchedule = (records: HealthRecord[], babyDob: string, now: number) =>
  buildSchedule(MILESTONE_PROMPTS, 'milestone', records, babyDob, now)

export function buildHealthOverview(records: HealthRecord[], babyDob: string, now: number) {
  const vaccines = buildVaccineSchedule(records, babyDob, now)
  const milestones = buildMilestoneSchedule(records, babyDob, now)
  const appointments = sortHealthRecords(records.filter((record) => record.kind === 'appointment'))
  return {
    vaccines,
    milestones,
    appointments,
    upcomingAppointments: appointments.filter((record) => record.at >= now && !record.completed).sort((a, b) => a.at - b.at),
    pastAppointments: appointments.filter((record) => record.at < now || record.completed),
    vaccinesDue: vaccines.filter((row) => row.status === 'due'),
    milestonesDue: milestones.filter((row) => row.status === 'due'),
    // Anything the caregiver logged that is not part of the reference schedules.
    customRecords: records.filter((record) => record.kind !== 'appointment' && !matchesSchedule(record)),
  }
}

const SCHEDULE_NAMES = new Set([
  ...VACCINE_SCHEDULE.map((item) => `vaccine:${item.name}:${item.detail ?? ''}`),
  ...MILESTONE_PROMPTS.map((item) => `milestone:${item.name}:`),
])

const matchesSchedule = (record: HealthRecord) => SCHEDULE_NAMES.has(`${record.kind}:${record.name}:${record.note ?? ''}`)
