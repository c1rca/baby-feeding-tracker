import type { ChangeEvent, RefObject } from 'react'
import type { TrackerExportState } from '../../state/trackerStateExport'
import { decodeTrackerExport, makeTrackerExport } from '../../state/trackerStateExport'
import { buildCareReport } from '../../domain/careReport'
import { buildDailySummaryCsv, buildEventsCsv } from '../../state/trackerCsvExport'
import { buildCareReportHtml } from '../../state/careReportDocument'
import type { UnitPreferences } from '../../domain/units'

type TrackerStateSetters = {
  setEntries: (value: TrackerExportState['entries']) => void
  setDiapers: (value: TrackerExportState['diapers']) => void
  setMedicines: (value: TrackerExportState['medicines']) => void
  setTummyTimes: (value: TrackerExportState['tummyTimes']) => void
  setPumpEvents: (value: TrackerExportState['pumpEvents']) => void
  setPumpSession: (value: TrackerExportState['pumpSession']) => void
  setTummySession: (value: TrackerExportState['tummySession']) => void
  setTummyGoalMinutes: (value: number) => void
  setPumpGoalOunces: (value: number) => void
  setPumpGoalSessions: (value: number) => void
  setGrowthMeasurements: (value: TrackerExportState['growthMeasurements']) => void
  setHealthRecords: (value: TrackerExportState['healthRecords']) => void
  setBabyDob: (value: string) => void
  setSession: (value: TrackerExportState['session']) => void
  setTheme: (value: TrackerExportState['theme']) => void
  setUndoState: (value: null) => void
  showToast: (message: string) => void
}

type ExportSettingsDataArgs = { state: TrackerExportState; showToast: (message: string) => void }

function downloadFile(contents: string, filename: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportSettingsData({ state, showToast }: ExportSettingsDataArgs) {
  const payload = makeTrackerExport(state)
  downloadFile(JSON.stringify(payload, null, 2), `feeding-tracker-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  showToast('Complete local tracker data exported')
}

type CareReportArgs = {
  state: TrackerExportState
  units: UnitPreferences
  babyName?: string
  babyProfile?: Parameters<typeof buildCareReport>[0]['babyProfile']
  rangeDays?: number
  now?: number
  showToast: (message: string) => void
}

const reportFor = ({ state, babyName, babyProfile, rangeDays = 30, now = Date.now() }: Omit<CareReportArgs, 'showToast' | 'units'>) =>
  buildCareReport({ ...state, babyName, babyProfile, now, rangeDays })

export function exportEventsCsv({ state, units, showToast }: CareReportArgs) {
  const csv = buildEventsCsv({ ...state, units })
  downloadFile(csv, `feeding-tracker-events-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
  showToast('Event history exported as CSV')
}

export function exportDailySummaryCsv({ state, units, babyName, babyProfile, rangeDays, now, showToast }: CareReportArgs) {
  const csv = buildDailySummaryCsv(reportFor({ state, babyName, babyProfile, rangeDays, now }), units)
  downloadFile(csv, `feeding-tracker-daily-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
  showToast('Daily summary exported as CSV')
}

// Opens the printable summary in its own window so the browser's own print
// dialog can save it as a PDF. Blocked popups fall back to a download.
export function openCareReport({ state, units, babyName, babyProfile, rangeDays, now, showToast }: CareReportArgs) {
  const html = buildCareReportHtml(reportFor({ state, babyName, babyProfile, rangeDays, now }), units)
  const printWindow = typeof window === 'undefined' ? null : window.open('', '_blank')
  if (!printWindow) {
    downloadFile(html, `care-summary-${new Date().toISOString().slice(0, 10)}.html`, 'text/html')
    showToast('Pop-up blocked — care summary downloaded instead')
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  showToast('Care summary ready to print')
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
  setters.setPumpGoalOunces(state.pumpGoalOunces)
  setters.setPumpGoalSessions(state.pumpGoalSessions)
  setters.setGrowthMeasurements(state.growthMeasurements)
  setters.setHealthRecords(state.healthRecords ?? [])
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
  setters.setHealthRecords([])
  setters.setSession(null)
  setters.setPumpSession(null)
  setters.setTummySession(null)
  setters.setUndoState(null)
  setters.showToast('All local health data and active timers cleared')
}

export function openSettingsImportPicker(fileInputRef: RefObject<HTMLInputElement | null>) { fileInputRef.current?.click() }
