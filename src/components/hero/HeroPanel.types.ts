import type { DiaperKind, MedicineKind, Session, Side, TummyTimeSession } from '../../types'

export type HeroPanelProps = {
  session: Session | null
  activeSeconds: number
  activeSplit: { left: number; right: number }
  activeSide?: Side | null
  activeOppositeSide: Side
  suggestedSide: Side
  nextFeedWindowText: string
  nextFeedSideText: string
  lastFeedMetaText: string
  avgGapShortText: string | null
  hasLastFeed: boolean
  startOffsetOpen: boolean
  startInputMode: 'clock' | 'minutes'
  startClockText: string
  startMinutesAgo: string
  selectedStartMinutesAgo: number
  selectedDiapers: DiaperKind[]
  availableSelectedDiapers: DiaperKind[]
  additionalOptionsOpen: boolean
  tummySession: TummyTimeSession | null
  tummyActiveSeconds: number
  setTummySession: (updater: TummyTimeSession | ((session: TummyTimeSession | null) => TummyTimeSession | null) | null) => void
  setStartOffsetOpen: (updater: (open: boolean) => boolean) => void
  setStartInputMode: (mode: 'clock' | 'minutes') => void
  setStartClockText: (value: string) => void
  setStartMinutesAgo: (value: string) => void
  setAdditionalOptionsOpen: (updater: (open: boolean) => boolean) => void
  setBottleOpen: (open: boolean) => void
  setManualOpen: (open: boolean) => void
  setSession: (session: Session) => void
  startSession: (side: Side) => void
  switchSide: (side: Side) => void
  pause: () => void
  resume: (side: Side) => void
  endSession: () => void
  clearSession: () => void
  toggleDiaperSelection: (kind: DiaperKind) => void
  logSelectedDiapers: () => void
  logDiaperKinds: (kinds: DiaperKind[]) => void
  logMedicine: (kind: MedicineKind) => void
  logTummyTimeMinutes: (minutes: number) => void
  startTummyTime: () => void
  stopTummyTime: () => void
  startSleep: () => void
  stopSleep: () => void
}
