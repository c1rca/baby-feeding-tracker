import type { ChangeEvent, RefObject } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import type { DiaperEvent, Entry } from '../../types'
import { clearSettingsData, exportSettingsData, importSettingsData, openSettingsImportPicker } from './settingsDataActions'

type SettingsDataControlsProps = {
  entries: Entry[]
  diapers: DiaperEvent[]
  fileInputRef: RefObject<HTMLInputElement | null>
  setEntries: (entries: Entry[]) => void
  setDiapers: (diapers: DiaperEvent[]) => void
  setSession: (session: null) => void
  setUndoState: (undoState: null) => void
  showToast: (message: string) => void
}

export function SettingsDataControls({ entries, diapers, fileInputRef, setEntries, setDiapers, setSession, setUndoState, showToast }: SettingsDataControlsProps) {
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    void importSettingsData({ event, setEntries, setDiapers, showToast })
  }

  return (
    <div className="settings-group">
      <p className="settings-lead">Your log is stored on this device. Keep a backup, restore one, or wipe everything.</p>
      <div className="settings-card">
        <div className="setting-row">
          <span className="setting-row-text">
            <strong>Backup &amp; restore</strong>
            <small>Save a JSON snapshot or import a previous one.</small>
          </span>
          <div className="settings-form-actions">
            <button aria-label="Export JSON" onClick={() => exportSettingsData({ entries, diapers, showToast })}>
              <Download size={16} /> Export
            </button>
            <button aria-label="Import JSON" onClick={() => openSettingsImportPicker(fileInputRef)}>
              <Upload size={16} /> Import
            </button>
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-row-text">
            <strong>Clear all data</strong>
            <small>Permanently remove every feed and diaper on this device.</small>
          </span>
          <button className="danger" aria-label="Clear all data" onClick={() => clearSettingsData({ setEntries, setDiapers, setSession, setUndoState, showToast })}>
            <Trash2 size={16} /> Clear all data
          </button>
        </div>
      </div>
      <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={handleImport} />
    </div>
  )
}
