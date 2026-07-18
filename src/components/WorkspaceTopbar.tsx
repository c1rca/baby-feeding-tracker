import { Baby, Settings2 } from 'lucide-react'
import type { BabySummary } from '../babies/babyApi'
import type { SyncStatus } from '../sync/serverSyncTypes'
import { CareNotificationCenter } from './notifications/CareNotificationCenter'
import type { CareNotification } from './notifications/notificationModel'

const syncLabel: Record<SyncStatus, string> = { syncing: 'Syncing', synced: 'Online', offline: 'Offline changes saved', issue: 'Sync issue' }

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
        {syncStatus !== 'synced' ? <span className={`sync-pill sync-${syncStatus}`} aria-label={`Sync status: ${syncLabel[syncStatus]}`}>{syncLabel[syncStatus]}</span> : null}
        <button type="button" className="desktop-settings" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><Settings2 size={18} /><span>Settings</span></button>
        <CareNotificationCenter notifications={careNotifications} />
        {babies.length > 1 ? <select aria-label="Active baby" value={selectedBabyId} onChange={(event) => onSelectedBabyIdChange(event.target.value)}>{babies.map((baby) => <option key={baby.id} value={baby.id}>{baby.name}</option>)}</select> : null}
      </div>
    </header>
  )
}
