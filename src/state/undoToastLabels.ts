import type { UndoState } from '../types'

const UNDO_TOAST_TEXT = {
  resume: 'Session resumed',
  'clear-session': 'Active feed cleared',
  'diaper-log': 'Diaper logged',
  'diaper-delete': 'Diaper deleted',
  'medicine-log': 'Medicine logged',
  'medicine-delete': 'Medicine deleted',
  'tummy-log': 'Tummy Time saved',
  'tummy-delete': 'Tummy Time deleted',
  delete: 'Entry deleted',
} as const

const UNDO_LABELS = {
  resume: 'Undo resume',
  'clear-session': 'Undo clear active feed',
  'diaper-log': 'Undo diaper log',
  'diaper-delete': 'Undo diaper delete',
  'medicine-log': 'Undo medicine log',
  'medicine-delete': 'Undo medicine delete',
  'tummy-log': 'Undo Tummy Time log',
  'tummy-delete': 'Undo Tummy Time delete',
  delete: 'Undo delete',
} as const

type UndoKind = NonNullable<UndoState>['kind']

export const undoToastTextFor = (undoState: UndoState | null) => undoState ? UNDO_TOAST_TEXT[undoState.kind as UndoKind] : 'Entry deleted'

export const undoLabelFor = (undoState: UndoState | null) => undoState ? UNDO_LABELS[undoState.kind as UndoKind] : 'Undo delete'
