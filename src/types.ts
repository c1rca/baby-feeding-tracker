import type { SideSegment } from './domain/feedingUtils'
import type { GrowthMeasurement } from './domain/growthTypes'

export type Side = 'left' | 'right'
export type FeedType = 'breast' | 'bottle' | 'mixed'
export type Segment = SideSegment
export type DiaperKind = 'wet' | 'stool'
// What was actually in the bottle. Absent on records logged before this existed.
export type BottleContent = 'breastmilk' | 'formula' | 'mixed'
// The three built-ins carry reminder scheduling. 'custom' covers everything
// else a household gives — iron, probiotics, reflux meds — and carries its own
// name; those are logged and reported but deliberately not scheduled.
export type MedicineKind = 'tylenol' | 'motrin' | 'vitamin_d' | 'custom'
// 'custom' sessions carry a trackerId. Reusing this kind rather than adding a
// parallel session shape keeps "is a timer running?" a single question — the
// hero, the rhythm ribbon and the notifications all ask it.
export type CareTimerKind = 'tummy' | 'sleep' | 'custom'
export type TummyTimeEvent = { id: string; startedAt: number; endedAt: number; note?: string; kind?: CareTimerKind; trackerId?: string }
export type TummyTimeSession = { id: string; startedAt: number; note: string; kind?: CareTimerKind; trackerId?: string; runningStartedAt?: number | null; elapsedSeconds?: number }
export type PumpEvent = { id: string; startedAt: number; endedAt: number; leftOunces: number | null; rightOunces: number | null; note?: string }
export type PumpSession = { id: string; startedAt: number; side: 'left' | 'both' | 'right'; runningStartedAt?: number | null; elapsedSeconds?: number }
export type Theme = 'light' | 'dark'
export type View = 'track' | 'stats'

export type Entry = {
  id: string
  sourceSessionId?: string
  type: FeedType
  startedAt: number
  endedAt: number
  leftSeconds: number
  rightSeconds: number
  bottleOunces: number | null
  bottleContent?: BottleContent
  note?: string
  diaperKinds?: DiaperKind[]
}

export type DiaperEvent = {
  id: string
  kind?: DiaperKind
  kinds?: DiaperKind[]
  at: number
  context: 'standalone' | 'feed'
  feedStartedAt?: number
}

export type MedicineEvent = { id: string; kind: MedicineKind; at: number; name?: string }

export type HealthRecordKind = 'vaccine' | 'milestone' | 'appointment'
// `at` is when it happened for a vaccine or milestone, and when it is scheduled
// for an appointment. `completed` marks an appointment as attended.
export type HealthRecord = { id: string; kind: HealthRecordKind; name: string; at: number; completed?: boolean; note?: string }

// Caregiver-defined trackers that behave like the built-in rows in Today's
// needs. `icon` and `hue` are keys into curated sets, never free values: a
// hex colour or an arbitrary icon name would eventually render unreadably in
// one of the two themes, and the definition has to stay serialisable to sync.
export type CustomTrackerGoal =
  | { kind: 'once' }
  | { kind: 'count'; target: number }
  | { kind: 'duration'; targetMinutes: number }

// When to nudge. An interval is measured from the last log of the day, so a
// tracker that is being kept up with never nags; a time of day fires once, for
// the things that belong to a moment rather than a rhythm.
export type CustomTrackerReminder =
  | { kind: 'interval'; everyHours: number }
  | { kind: 'timeOfDay'; atMinutes: number }

export type CustomTracker = {
  id: string
  name: string
  icon: string
  hue: string
  goal: CustomTrackerGoal
  timer?: boolean
  reminder?: CustomTrackerReminder | null
  createdAt: number
  // Archived, never deleted: removing a definition whose events are still
  // logged would orphan them and silently rewrite history.
  archivedAt?: number | null
}

// One logged instance. `goalAtLog` is the target that applied when it was
// logged, so editing a goal later cannot retroactively change whether a past
// day counted as done.
export type CustomEvent = {
  id: string
  trackerId: string
  at: number
  durationSeconds?: number
  goalAtLog?: CustomTrackerGoal
  note?: string
}

// How many a caregiver may define. Today's needs has to stay scannable, and
// the whole-state payload has to stay small enough to send on every change.
export const CUSTOM_TRACKER_LIMIT = 12

export type Session = {
  id: string
  startedAt: number
  activeSide: Side | null
  segmentStart: number | null
  segments: Segment[]
  bottleOunces: number
  bottleContent?: BottleContent
  note: string
  diaperKinds: DiaperKind[]
}

export type LegacySession = Omit<Session, 'id' | 'note' | 'bottleOunces' | 'diaperKinds'> & {
  id?: string
  note?: string
  bottleOunces?: number
  diaperKinds?: DiaperKind[]
}

export type ServerState = {
  entries?: Entry[]
  diapers?: DiaperEvent[]
  medicines?: MedicineEvent[]
  tummyTimes?: TummyTimeEvent[]
  pumpEvents?: PumpEvent[]
  pumpSession?: PumpSession | null
  tummySession?: TummyTimeSession | null
  tummyGoalMinutes?: number
  pumpGoalOunces?: number
  pumpGoalSessions?: number
  growthMeasurements?: GrowthMeasurement[]
  healthRecords?: HealthRecord[]
  customTrackers?: CustomTracker[]
  customEvents?: CustomEvent[]
  babyDob?: string
  session?: LegacySession | null
  theme?: Theme
  updatedAt?: string | null
}

export type UndoState =
  | { entry: Entry; timeoutId: number; kind: 'delete' | 'resume'; previousSession?: Session | null }
  | { diaper: DiaperEvent; timeoutId: number; kind: 'diaper-log' | 'diaper-delete' }
  | { medicine: MedicineEvent; timeoutId: number; kind: 'medicine-log' | 'medicine-delete' }
  | { tummyTime: TummyTimeEvent; timeoutId: number; kind: 'tummy-log' | 'tummy-delete' }
  | { pumpEvent: PumpEvent; timeoutId: number; kind: 'pump-log' | 'pump-delete' }
  | { customEvent: CustomEvent; timeoutId: number; kind: 'custom-log' | 'custom-delete' }
  | { session: Session; timeoutId: number; kind: 'clear-session' }

export type EditingState = {
  id: string
  date: string
  leftMinutes: string
  rightMinutes: string
  bottleOunces: string
  note: string
  diaperKinds: DiaperKind[]
} | null

export type EditingDiaperState = { id: string; date: string; kinds: DiaperKind[]; originalAt: number } | null
export type EditingMedicineState = { id: string; date?: string; kind: MedicineKind; time: string; originalAt: number } | null
export type EditingTummyTimeState = { id: string; startDate: string; startTime: string; endTime: string; note: string; originalStartedAt: number; originalEndedAt: number } | null
