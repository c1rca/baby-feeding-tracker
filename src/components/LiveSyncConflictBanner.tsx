/* eslint-disable react-hooks/set-state-in-effect -- clearing a delayed visual-only banner never mutates sync state. */
import { useEffect, useState } from 'react'
import { GitCompareArrows } from 'lucide-react'
import type { ServerState } from '../types'
import type { LiveSyncConflictChoice } from '../sync/useServerSync'

// Shown only in the rare case where a live update arrives while THIS device has
// unsaved local edits. It never auto-discards either side — the user chooses.
// (Most concurrent edits reconcile automatically via the server merge and never
// surface this banner; it mainly appears when this device is offline.)
//
// A conflict raised while this device's own write is still in flight usually
// clears itself a moment later, when that write lands and adopts the server's
// merged truth. Rendering it immediately turns that into a banner that appears
// and vanishes unprompted, asking the caregiver to arbitrate something already
// settled. Waiting means only a disagreement that actually persists — one that
// genuinely needs a decision — is ever put in front of them.
const CONFLICT_SETTLE_MS = 2500

export function LiveSyncConflictBanner({ conflict, onResolve }: { conflict: ServerState | null; onResolve: (choice: LiveSyncConflictChoice) => void }) {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!conflict) {
      setSettled(false)
      return
    }
    const timer = setTimeout(() => setSettled(true), CONFLICT_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [conflict])

  if (!conflict || !settled) return null
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
