import type { SideSegment } from './domain/feedingUtils'
import type { GrowthMeasurement } from './domain/growthTypes'

export type Side = 'left' | 'right'
export type FeedType = 'breast' | 'bottle' | 'mixed'
export type Segment = SideSegment
export type DiaperKind = 'wet' | 'stool'
export type MedicineKind = 'tylenol' | 'motrin' | 'vitamin_d'
export type CareTimerKind = 'tummy' | 'sleep'
export type TummyTimeEvent = { id: string; startedAt: number; endedAt: number; note?: string; kind?: CareTimerKind }
export type TummyTimeSession = { id: string; startedAt: number; note: string; kind?: CareTimerKind; runningStartedAt?: number | null; elapsedSeconds?: number }
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

export type MedicineEvent = { id: string; kind: MedicineKind; at: number }

export type Session = {
  id: string
  startedAt: number
  activeSide: Side | null
  segmentStart: number | null
  segments: Segment[]
  bottleOunces: number
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
  growthMeasurements?: GrowthMeasurement[]
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
  | { session: Session; timeoutId: number; kind: 'clear-session' }

export type EditingState = {
  id: string
  leftMinutes: string
  rightMinutes: string
  bottleOunces: string
  note: string
  diaperKinds: DiaperKind[]
} | null

export type EditingDiaperState = { id: string; kinds: DiaperKind[] } | null
export type EditingMedicineState = { id: string; kind: MedicineKind; time: string; originalAt: number } | null
export type EditingTummyTimeState = { id: string; startTime: string; endTime: string; note: string; originalStartedAt: number; originalEndedAt: number } | null
