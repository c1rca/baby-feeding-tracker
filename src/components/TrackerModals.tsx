import { useEffect, useRef } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import { Baby, Download, Trash2, Upload } from 'lucide-react'
import type { DiaperEvent, Entry, Session } from '../types'
import { formatDateInput, formatTimeInput } from '../domain/trackerDomain'

type ManualDraft = { date: string; time: string; leftMinutes: string; rightMinutes: string; bottleOunces: string; note: string }

type TrackerModalsProps = {
  bottleOpen: boolean
  manualOpen: boolean
  settingsOpen: boolean
  session: Session | null
  bottleQuickOz: number
  manualDraft: ManualDraft
  entries: Entry[]
  diapers: DiaperEvent[]
  feedingNotificationsEnabled: boolean
  notificationPermission: NotificationPermission
  gotifyAvailable: boolean
  gotifyRemindersEnabled: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  setBottleOpen: (open: boolean) => void
  setManualOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setBottleQuickOz: (updater: (value: number) => number) => void
  setManualDraft: (draft: ManualDraft) => void
  setEntries: (updater: Entry[] | ((prev: Entry[]) => Entry[])) => void
  setDiapers: (updater: DiaperEvent[] | ((prev: DiaperEvent[]) => DiaperEvent[])) => void
  setSession: (session: Session | null) => void
  setUndoState: (state: null) => void
  setFeedingNotificationsEnabled: (enabled: boolean) => void
  logBottle: (oz?: number) => void
  saveManualFeed: () => void
  enableFeedingNotifications: () => void
  setGotifyReminders: (enabled: boolean) => void | Promise<void>
  showToast: (message: string) => void
}

export function TrackerModals({
  bottleOpen,
  manualOpen,
  settingsOpen,
  session,
  bottleQuickOz,
  manualDraft,
  entries,
  diapers,
  feedingNotificationsEnabled,
  notificationPermission,
  gotifyAvailable,
  gotifyRemindersEnabled,
  fileInputRef,
  setBottleOpen,
  setManualOpen,
  setSettingsOpen,
  setBottleQuickOz,
  setManualDraft,
  setEntries,
  setDiapers,
  setSession,
  setUndoState,
  setFeedingNotificationsEnabled,
  logBottle,
  saveManualFeed,
  enableFeedingNotifications,
  setGotifyReminders,
  showToast,
}: TrackerModalsProps) {
  const wasManualOpenRef = useRef(false)

  useEffect(() => {
    if (!manualOpen) {
      wasManualOpenRef.current = false
      return
    }
    if (wasManualOpenRef.current) return
    wasManualOpenRef.current = true
    const timestamp = new Date().getTime()
    setManualDraft({ ...manualDraft, date: formatDateInput(timestamp), time: formatTimeInput(timestamp) })
  }, [manualOpen, manualDraft, setManualDraft])

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
    <>
      {bottleOpen ? (
        <div className="modal-backdrop" onClick={() => setBottleOpen(false)}>
          <section className="card bottle-card modal-card" role="dialog" aria-modal="true" aria-label={session ? 'Add bottle to active feed' : 'Quick bottle log'} onClick={(e) => e.stopPropagation()}>
            <div className="hero-top"><h2>{session ? 'Add Bottle to Active Feed' : 'Quick Bottle Log'}</h2><span className="pill">One tap</span></div>
            <div className="preset-grid">{[2, 2.5, 3, 3.5, 4].map((oz) => <button key={oz} className="preset-btn" onClick={() => { logBottle(oz); setBottleOpen(false) }}>{oz.toFixed(1)} oz</button>)}</div>
            <div className="bottle-custom-row">
              <button onClick={() => setBottleQuickOz((v) => Math.max(0.5, +(v - 0.5).toFixed(1)))}>-</button>
              <strong className="bottle-amount">{bottleQuickOz.toFixed(1)} oz</strong>
              <button onClick={() => setBottleQuickOz((v) => +(v + 0.5).toFixed(1))}>+</button>
              <button className="primary" aria-label="Log bottle" onClick={() => { logBottle(); setBottleOpen(false) }}><Baby size={16} /> Log</button>
            </div>
          </section>
        </div>
      ) : null}

      {manualOpen ? (
        <div className="modal-backdrop" onClick={() => setManualOpen(false)}>
          <section className="card modal-card manual-card" role="dialog" aria-modal="true" aria-label="Add missed feed" onClick={(e) => e.stopPropagation()}>
            <div className="hero-top"><h2>Add Missed Feed</h2><span className="pill">Manual</span></div>
            <div className="manual-grid">
              <label>Feed date<input type="date" value={manualDraft.date} onChange={(e) => setManualDraft({ ...manualDraft, date: e.target.value })} /></label>
              <label>Feed time<input type="time" value={manualDraft.time} onChange={(e) => setManualDraft({ ...manualDraft, time: e.target.value })} /></label>
              <label>Manual left minutes<input inputMode="decimal" value={manualDraft.leftMinutes} onChange={(e) => setManualDraft({ ...manualDraft, leftMinutes: e.target.value })} placeholder="0" /></label>
              <label>Manual right minutes<input inputMode="decimal" value={manualDraft.rightMinutes} onChange={(e) => setManualDraft({ ...manualDraft, rightMinutes: e.target.value })} placeholder="0" /></label>
              <label>Manual bottle ounces<input inputMode="decimal" value={manualDraft.bottleOunces} onChange={(e) => setManualDraft({ ...manualDraft, bottleOunces: e.target.value })} placeholder="0.0" /></label>
              <label>Manual note<input value={manualDraft.note} onChange={(e) => setManualDraft({ ...manualDraft, note: e.target.value })} placeholder="optional" /></label>
            </div>
            <div className="row"><button className="primary" onClick={saveManualFeed}>Save missed feed</button><button onClick={() => setManualOpen(false)}>Cancel</button></div>
          </section>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <section className="card settings modal-card" role="dialog" aria-modal="true" aria-label="Settings and data" onClick={(e) => e.stopPropagation()}>
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
          </section>
        </div>
      ) : null}
    </>
  )
}
