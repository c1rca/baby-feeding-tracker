import { Baby, BarChart3, ClipboardList, LogOut, Moon, Settings, Sun } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { AuthUser } from '../auth/authApi'
import type { BabySummary } from '../babies/babyApi'
import type { View } from '../types'
type SyncStatus = 'syncing' | 'synced' | 'offline' | 'issue'

type AppHeaderProps = {
  view: View
  syncStatus: SyncStatus
  theme: 'light' | 'dark'
  settingsOpen: boolean
  setView: Dispatch<SetStateAction<View>>
  setTheme: Dispatch<SetStateAction<'light' | 'dark'>>
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  authUser?: AuthUser | null
  babies?: BabySummary[]
  selectedBabyId?: string
  onSelectedBabyIdChange?: (babyId: string) => void
  onLogout?: () => void
}

const syncLabel: Record<SyncStatus, string> = {
  synced: 'Online',
  syncing: 'Syncing',
  offline: 'Offline changes saved',
  issue: 'Connection issue',
}

export function AppHeader({ view, syncStatus, theme, settingsOpen, setView, setTheme, setSettingsOpen, authUser = null, babies = [], selectedBabyId = '', onSelectedBabyIdChange, onLogout }: AppHeaderProps) {
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
        <button className="icon-plain" aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        {authUser?.mode === 'session' && onLogout ? (
          <button className="icon-plain" aria-label="Sign out" title="Sign out" onClick={onLogout}>
            <LogOut size={17} />
          </button>
        ) : null}
      </div>
    </header>
  )
}
