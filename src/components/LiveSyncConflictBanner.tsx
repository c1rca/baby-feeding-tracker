import { GitCompareArrows } from 'lucide-react'
import type { ServerState } from '../types'
import type { LiveSyncConflictChoice } from '../sync/useServerSync'

// Shown only in the rare case where a live update arrives while THIS device has
// unsaved local edits. It never auto-discards either side — the user chooses.
// (Most concurrent edits reconcile automatically via the server merge and never
// surface this banner; it mainly appears when this device is offline.)
export function LiveSyncConflictBanner({ conflict, onResolve }: { conflict: ServerState | null; onResolve: (choice: LiveSyncConflictChoice) => void }) {
  if (!conflict) return null
  return (
    <div className="live-conflict-banner" role="alertdialog" aria-label="Sync conflict">
      <div className="live-conflict-copy">
        <span className="live-conflict-icon" aria-hidden="true"><GitCompareArrows size={17} /></span>
        <div>
          <strong>Another device made changes</strong>
          <span>You have unsaved edits on this device. Keep yours (both sides are merged) or switch to the latest from the other device.</span>
        </div>
      </div>
      <div className="live-conflict-actions">
        <button type="button" className="secondary" onClick={() => onResolve('mine')}>Keep mine</button>
        <button type="button" className="primary" onClick={() => onResolve('theirs')}>Use theirs</button>
      </div>
    </div>
  )
}
