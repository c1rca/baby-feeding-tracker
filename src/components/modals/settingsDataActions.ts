import type { ChangeEvent, RefObject } from 'react'
import type { TrackerExportState } from '../../state/trackerStateExport'
import { decodeTrackerExport, makeTrackerExport } from '../../state/trackerStateExport'

type TrackerStateSetters = {
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

type ExportSettingsDataArgs = { state: TrackerExportState; showToast: (message: string) => void }

export function exportSettingsData({ state, showToast }: ExportSettingsDataArgs) {
  const payload = makeTrackerExport(state)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `feeding-tracker-export-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  showToast('Complete local tracker data exported')
}

function applyState(state: TrackerExportState, setters: TrackerStateSetters) {
  setters.setEntries(state.entries)
  setters.setDiapers(state.diapers)
  setters.setMedicines(state.medicines)
  setters.setTummyTimes(state.tummyTimes)
  setters.setPumpEvents(state.pumpEvents)
  setters.setPumpSession(state.pumpSession)
  setters.setTummySession(state.tummySession)
  setters.setTummyGoalMinutes(state.tummyGoalMinutes)
  setters.setGrowthMeasurements(state.growthMeasurements)
  setters.setBabyDob(state.babyDob)
  setters.setSession(state.session)
  setters.setTheme(state.theme)
  setters.setUndoState(null)
}

export async function importSettingsData({ event, ...setters }: { event: ChangeEvent<HTMLInputElement> } & TrackerStateSetters) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const decoded = decodeTrackerExport(await file.text())
    if (!decoded.ok) throw new Error(decoded.error)
    if (!window.confirm('Replace all local tracker data for this baby with this backup? This replaces feeds, diapers, medicines, tummy time, pumping, growth, active timers, date of birth, and theme on this device.')) return
    applyState(decoded.value.state, setters)
    setters.showToast('Complete local tracker data imported')
  } catch {
    setters.showToast('Import failed: invalid or unsupported file')
  } finally {
    event.target.value = ''
  }
}

export function clearSettingsData(setters: TrackerStateSetters) {
  if (!window.confirm('Clear all local health data and active timers for this baby? This permanently removes feeds, diapers, medicines, tummy time, pumping, and growth records on this device. Date of birth, tummy-time goal, and theme are kept.')) return
  setters.setEntries([])
  setters.setDiapers([])
  setters.setMedicines([])
  setters.setTummyTimes([])
  setters.setPumpEvents([])
  setters.setGrowthMeasurements([])
  setters.setSession(null)
  setters.setPumpSession(null)
  setters.setTummySession(null)
  setters.setUndoState(null)
  setters.showToast('All local health data and active timers cleared')
}

export function openSettingsImportPicker(fileInputRef: RefObject<HTMLInputElement | null>) { fileInputRef.current?.click() }
