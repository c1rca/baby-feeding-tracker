import type { SideSegment } from './domain/feedingUtils'

export type Side = 'left' | 'right'
export type FeedType = 'breast' | 'bottle' | 'mixed'
export type Segment = SideSegment
export type DiaperKind = 'wet' | 'stool'
export type MedicineKind = 'tylenol' | 'motrin'
export type Theme = 'light' | 'dark'
export type View = 'track' | 'stats'

export type Entry = {
  id: string
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
  startedAt: number
  activeSide: Side | null
  segmentStart: number | null
  segments: Segment[]
  bottleOunces: number
  note: string
  diaperKinds: DiaperKind[]
}

export type LegacySession = Omit<Session, 'note' | 'bottleOunces' | 'diaperKinds'> & {
  note?: string
  bottleOunces?: number
  diaperKinds?: DiaperKind[]
}

export type ServerState = {
  entries?: Entry[]
  diapers?: DiaperEvent[]
  medicines?: MedicineEvent[]
  session?: LegacySession | null
  theme?: Theme
  updatedAt?: string | null
}

export type UndoState =
  | { entry: Entry; timeoutId: number; kind: 'delete' | 'resume'; previousSession?: Session | null }
  | { diaper: DiaperEvent; timeoutId: number; kind: 'diaper-log' | 'diaper-delete' }
  | { medicine: MedicineEvent; timeoutId: number; kind: 'medicine-log' | 'medicine-delete' }
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
