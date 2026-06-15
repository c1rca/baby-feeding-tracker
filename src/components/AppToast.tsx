import { RotateCcw } from 'lucide-react'
import type { UndoState } from '../types'

type AppToastProps = {
  toast: string | null
  undoState: UndoState | null
  undoToastText: string
  undoLabel: string
  undo: () => void
}

export function AppToast({ toast, undoState, undoToastText, undoLabel, undo }: AppToastProps) {
  if (!toast && !undoState) return null

  return (
    <div className="toast">
      <span>{toast || undoToastText}</span>
      {undoState ? <button aria-label={undoLabel} onClick={undo}><RotateCcw size={15} /> Undo</button> : null}
    </div>
  )
}
