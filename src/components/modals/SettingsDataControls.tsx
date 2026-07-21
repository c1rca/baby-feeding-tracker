import type { ChangeEvent, RefObject } from 'react'
import { Download, Trash2, Upload } from 'lucide-react'
import type { TrackerExportState } from '../../state/trackerStateExport'
import { clearSettingsData, exportSettingsData, importSettingsData, openSettingsImportPicker } from './settingsDataActions'

type SettingsDataControlsProps = TrackerExportState & {
  fileInputRef: RefObject<HTMLInputElement | null>
  setEntries: (value: TrackerExportState['entries']) => void
  setDiapers: (value: TrackerExportState['diapers']) => void
  setMedicines: (value: TrackerExportState['medicines']) => void
  setTummyTimes: (value: TrackerExportState['tummyTimes']) => void
  setPumpEvents: (value: TrackerExportState['pumpEvents']) => void
  setPumpSession: (value: TrackerExportState['pumpSession']) => void
  setTummySession: (value: TrackerExportState['tummySession']) => void
  setTummyGoalMinutes: (value: number) => void
  setGrowthMeasurements: (value: TrackerExportState['growthMeasurements']) => void
  setBabyDob: (value: string) => void
  setSession: (value: TrackerExportState['session']) => void
  setTheme: (value: TrackerExportState['theme']) => void
  setUndoState: (value: null) => void
  showToast: (message: string) => void
}

export function SettingsDataControls(props: SettingsDataControlsProps) {
  const { fileInputRef, showToast, ...stateAndSetters } = props
  const state: TrackerExportState = {
    entries: props.entries, diapers: props.diapers, medicines: props.medicines, tummyTimes: props.tummyTimes, pumpEvents: props.pumpEvents,
    pumpSession: props.pumpSession, tummySession: props.tummySession, tummyGoalMinutes: props.tummyGoalMinutes, growthMeasurements: props.growthMeasurements,
    babyDob: props.babyDob, session: props.session, theme: props.theme,
  }
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => { void importSettingsData({ event, ...stateAndSetters, showToast }) }

  return <div className="settings-group">
    <p className="settings-lead">Export or replace this baby’s complete local tracker data. These actions are local to this device and do not confirm a server backup or deletion.</p>
    <div className="settings-card">
      <div className="setting-row">
        <span className="setting-row-text"><strong>Complete backup &amp; restore</strong><small>Save or replace feeds, diapers, medicines, tummy time, pumping, growth, active timers, birth date, goal, and theme.</small></span>
        <div className="settings-form-actions">
          <button aria-label="Export JSON" onClick={() => exportSettingsData({ state, showToast })}><Download size={16} /> Export</button>
          <button aria-label="Import JSON" onClick={() => openSettingsImportPicker(fileInputRef)}><Upload size={16} /> Import</button>
        </div>
      </div>
      <div className="setting-row">
        <span className="setting-row-text"><strong>Clear local health data</strong><small>Remove all local health records and active timers. Your birth date, tummy-time goal, and theme stay unchanged.</small></span>
        <button className="danger" aria-label="Clear all data" onClick={() => clearSettingsData({ ...stateAndSetters, showToast })}><Trash2 size={16} /> Clear local data</button>
      </div>
    </div>
    <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={handleImport} />
  </div>
}
