import type { ChangeEvent } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import type { DiaperEvent, Entry } from '../../types'
import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'

type SettingsModalProps = Pick<TrackerModalsProps, 'entries' | 'diapers' | 'feedingNotificationsEnabled' | 'notificationPermission' | 'gotifyAvailable' | 'gotifyRemindersEnabled' | 'fileInputRef' | 'setSettingsOpen' | 'setEntries' | 'setDiapers' | 'setSession' | 'setUndoState' | 'setFeedingNotificationsEnabled' | 'enableFeedingNotifications' | 'setGotifyReminders' | 'showToast'>

export function SettingsModal({ entries, diapers, feedingNotificationsEnabled, notificationPermission, gotifyAvailable, gotifyRemindersEnabled, fileInputRef, setSettingsOpen, setEntries, setDiapers, setSession, setUndoState, setFeedingNotificationsEnabled, enableFeedingNotifications, setGotifyReminders, showToast }: SettingsModalProps) {
  const exportJson = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), entries, diapers }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `feeding-tracker-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Data exported')
  }

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = JSON.parse(text) as { entries?: Entry[]; diapers?: DiaperEvent[] }
      if (!parsed.entries) throw new Error('Invalid data')
      setEntries(parsed.entries.sort((a, b) => b.endedAt - a.endedAt))
      if (Array.isArray(parsed.diapers)) setDiapers(parsed.diapers.sort((a, b) => b.at - a.at))
      showToast('Data imported')
    } catch {
      showToast('Import failed: invalid file')
    } finally {
      event.target.value = ''
    }
  }

  const clearAllData = () => {
    if (!window.confirm('Clear all feeding data? Export a backup first if needed.')) return
    setEntries([])
    setDiapers([])
    setSession(null)
    setUndoState(null)
    showToast('All data cleared')
  }

  return (
    <ModalFrame label="Settings and data" className="settings" onClose={() => setSettingsOpen(false)}>
      <h2>Settings & Data</h2>
      <div className="notification-setting">
        <div>
          <strong>Next feeding reminders</strong>
          <p className="muted">Browser/mobile notifications at 2 and 3 hours after each feed. Opens Feedr.</p>
          <small>Permission: {notificationPermission}</small>
        </div>
        {feedingNotificationsEnabled && notificationPermission === 'granted' ? <button type="button" onClick={() => { setFeedingNotificationsEnabled(false); showToast('Feeding reminders disabled') }}>Turn off</button> : <button type="button" className="primary" onClick={enableFeedingNotifications}>Enable reminders</button>}
      </div>
      <div className="notification-setting">
        <div>
          <strong>Gotify reminders</strong>
          <p className="muted">Server-side reminders that still work when this page is closed.</p>
          <small>Status: {gotifyAvailable ? (gotifyRemindersEnabled ? 'on' : 'off') : 'not configured'}</small>
        </div>
        <button type="button" className={gotifyRemindersEnabled ? '' : 'primary'} disabled={!gotifyAvailable} onClick={() => void setGotifyReminders(!gotifyRemindersEnabled)}>{gotifyRemindersEnabled ? 'Turn off' : 'Turn on'}</button>
      </div>
      <div className="row"><button aria-label="Export JSON" onClick={exportJson}><Download size={16} /> Export JSON</button><button aria-label="Import JSON" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import JSON</button><button className="danger" onClick={clearAllData}><Trash2 size={16} /> Clear all data</button></div>
      <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={importJson} />
    </ModalFrame>
  )
}
