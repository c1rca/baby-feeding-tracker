import { Baby, BarChart3, ClipboardList, Moon, Settings, Sun } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { View } from '../types'
type SyncStatus = 'syncing' | 'synced' | 'offline'

type AppHeaderProps = {
  view: View
  syncStatus: SyncStatus
  theme: 'light' | 'dark'
  settingsOpen: boolean
  setView: Dispatch<SetStateAction<View>>
  setTheme: Dispatch<SetStateAction<'light' | 'dark'>>
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
}

export function AppHeader({ view, syncStatus, theme, settingsOpen, setView, setTheme, setSettingsOpen }: AppHeaderProps) {
  return (
    <header className="top">
      <h1><Baby size={20} /> Baby Feeding Tracker</h1>
      <div className="top-actions">
        <button className={`icon-plain view-icon-toggle ${view === 'stats' ? 'active' : ''}`} aria-label={view === 'stats' ? 'Show tracker' : 'Show stats'} title={view === 'stats' ? 'Show tracker' : 'Show stats'} onClick={() => setView((current) => current === 'stats' ? 'track' : 'stats')}>
          {view === 'stats' ? <ClipboardList size={18} /> : <BarChart3 size={18} />}
        </button>
        {syncStatus !== 'synced' && (
          <span className={`sync-pill sync-${syncStatus}`}>{syncStatus === 'syncing' ? 'Syncing…' : 'Offline changes saved'}</span>
        )}
        <button className="icon-plain" aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button className="icon-plain" aria-label={settingsOpen ? 'Hide settings' : 'Show settings'} onClick={() => setSettingsOpen((v) => !v)}>
          <Settings size={17} />
        </button>
      </div>
    </header>
  )
}
