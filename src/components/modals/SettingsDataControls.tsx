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
    <>
      <div className="row">
        <button aria-label="Export JSON" onClick={() => exportSettingsData({ entries, diapers, showToast })}>
          <Download size={16} /> Export JSON
        </button>
        <button aria-label="Import JSON" onClick={() => openSettingsImportPicker(fileInputRef)}>
          <Upload size={16} /> Import JSON
        </button>
        <button className="danger" onClick={() => clearSettingsData({ setEntries, setDiapers, setSession, setUndoState, showToast })}>
          <Trash2 size={16} /> Clear all data
        </button>
      </div>
      <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={handleImport} />
    </>
  )
}
