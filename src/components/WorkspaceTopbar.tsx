/* eslint-disable react-hooks/set-state-in-effect -- clearing a delayed visual-only pill never mutates sync state. */
import { useEffect, useState } from 'react'
import { Baby, Settings2, Sun, X } from 'lucide-react'
import type { BabySummary } from '../babies/babyApi'
import type { SyncStatus } from '../sync/serverSyncTypes'
import { CareNotificationCenter } from './notifications/CareNotificationCenter'
import type { CareNotification } from './notifications/notificationModel'

const syncLabel: Record<SyncStatus, string> = { syncing: 'Syncing', synced: 'Online', offline: 'Offline changes saved', issue: 'Sync issue' }

// Healthy sync is silent. 'syncing' and 'synced' are both normal and change on
// every edit, so only states a caregiver could act on are candidates at all.
const needsAttention = (status: SyncStatus) => status === 'offline' || status === 'issue'

// ...and even those must persist before they are shown. A device that was
// closed mid-write starts up already marked pending, so it renders "Offline
// changes saved" for the few hundred milliseconds before the first sync lands —
// a warning that flashes on an ordinary refresh and then contradicts itself.
// Nothing here is actionable until it has stayed true, so wait it out. Anything
// that resolves on its own is never shown.
const ATTENTION_SETTLE_MS = 4000

function useSettledSyncStatus(status: SyncStatus): SyncStatus | null {
  const [settled, setSettled] = useState<SyncStatus | null>(null)
  useEffect(() => {
    if (!needsAttention(status)) {
      setSettled(null)
      return
    }
    const timer = setTimeout(() => setSettled(status), ATTENTION_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [status])
  return settled
}

type WorkspaceTopbarProps = {
  activeWorkspace: 'track' | 'stats'
  navigateWorkspace: (next: 'track' | 'care' | 'stats') => void
  syncStatus: SyncStatus
  setSettingsOpen: (open: boolean) => void
  careNotifications: CareNotification[]
  babies: BabySummary[]
  selectedBabyId: string
  onSelectedBabyIdChange: (babyId: string) => void
}

export function WorkspaceTopbar({ activeWorkspace, navigateWorkspace, syncStatus, setSettingsOpen, careNotifications, babies, selectedBabyId, onSelectedBabyIdChange }: WorkspaceTopbarProps) {
  const settledSyncStatus = useSettledSyncStatus(syncStatus)
  const vitaminReminder = careNotifications.find((notification) => notification.kind === 'vitamin_d')
  const bellNotifications = vitaminReminder ? careNotifications.filter((notification) => notification.id !== vitaminReminder.id) : careNotifications
  return (
    <header className="workspace-topbar">
      <div className="workspace-brand">
        <span className="workspace-brand-mark"><Baby size={18} /></span>
        <h1>Baby Tracker</h1>
      </div>
      <nav className="desktop-workspace-nav" aria-label="Workspace">
        <button type="button" className={activeWorkspace === 'track' ? 'is-active' : ''} aria-current={activeWorkspace === 'track' ? 'page' : undefined} onClick={() => navigateWorkspace('track')}>Track</button>
        <button type="button" className={activeWorkspace === 'stats' ? 'is-active' : ''} aria-current={activeWorkspace === 'stats' ? 'page' : undefined} onClick={() => navigateWorkspace('stats')}>Insights</button>
      </nav>
      <div className="workspace-topbar-actions">
        {settledSyncStatus ? <span className={`sync-pill sync-${settledSyncStatus}`} aria-label={`Sync status: ${syncLabel[settledSyncStatus]}`}>{syncLabel[settledSyncStatus]}</span> : null}
        <button type="button" className="desktop-settings" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /><span>Settings</span></button>
        {vitaminReminder ? <aside className="vitamin-topbar-prompt" aria-label="Vitamin D reminder">
          <Sun size={15} aria-hidden="true" />
          <button type="button" className="vitamin-topbar-log" aria-label={vitaminReminder.ariaActionLabel} onClick={vitaminReminder.action}>Log Vitamin D</button>
          {vitaminReminder.dismiss ? <button type="button" className="vitamin-topbar-dismiss" aria-label="Dismiss Vitamin D reminder" onClick={vitaminReminder.dismiss}><X size={14} /></button> : null}
        </aside> : null}
        <CareNotificationCenter notifications={bellNotifications} />
        {babies.length > 1 ? <select aria-label="Active baby" value={selectedBabyId} onChange={(event) => onSelectedBabyIdChange(event.target.value)}>{babies.map((baby) => <option key={baby.id} value={baby.id}>{baby.name}</option>)}</select> : null}
      </div>
    </header>
  )
}
