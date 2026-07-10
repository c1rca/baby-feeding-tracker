import { Baby, BarChart3, ClipboardList, Settings } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { BabySummary } from '../babies/babyApi'
import type { View } from '../types'
type SyncStatus = 'syncing' | 'synced' | 'offline' | 'issue'

type AppHeaderProps = {
  view: View
  syncStatus: SyncStatus
  settingsOpen: boolean
  setView: Dispatch<SetStateAction<View>>
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  babies?: BabySummary[]
  selectedBabyId?: string
  onSelectedBabyIdChange?: (babyId: string) => void
}

const syncLabel: Record<SyncStatus, string> = {
  synced: 'Online',
  syncing: 'Syncing',
  offline: 'Offline changes saved',
  issue: 'Connection issue',
}

export function AppHeader({ view, syncStatus, settingsOpen, setView, setSettingsOpen, babies = [], selectedBabyId = '', onSelectedBabyIdChange }: AppHeaderProps) {
  return (
    <header className="top">
      <h1><span className="brand-mark"><Baby size={22} /></span> Baby Feeding Tracker</h1>
      <div className="top-actions">
        {babies.length > 1 && onSelectedBabyIdChange ? (
          <label className="baby-switcher">
            <span className="sr-only">Active baby</span>
            <select aria-label="Active baby" value={selectedBabyId} onChange={(event) => onSelectedBabyIdChange(event.target.value)}>
              {babies.map((baby) => <option key={baby.id} value={baby.id}>{baby.name}</option>)}
            </select>
          </label>
        ) : null}
        <span className={`sync-pill sync-${syncStatus}`} aria-label={`Sync status: ${syncLabel[syncStatus]}`}>{syncLabel[syncStatus]}</span>
        <button className={`icon-plain view-icon-toggle ${view === 'stats' ? 'active' : ''}`} aria-label={view === 'stats' ? 'Show tracker' : 'Show stats'} title={view === 'stats' ? 'Show tracker' : 'Show stats'} onClick={() => setView((current) => current === 'stats' ? 'track' : 'stats')}>
          {view === 'stats' ? <ClipboardList size={18} /> : <BarChart3 size={18} />}
        </button>
        <button className="icon-plain" aria-label={settingsOpen ? 'Hide settings' : 'Show settings'} onClick={() => setSettingsOpen((v) => !v)}>
          <Settings size={17} />
        </button>
      </div>
    </header>
  )
}
