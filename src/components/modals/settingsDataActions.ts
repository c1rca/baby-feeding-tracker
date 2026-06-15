import type { ChangeEvent, RefObject } from 'react'
import type { DiaperEvent, Entry } from '../../types'

type ExportSettingsDataArgs = {
  entries: Entry[]
  diapers: DiaperEvent[]
  showToast: (message: string) => void
}

export function exportSettingsData({ entries, diapers, showToast }: ExportSettingsDataArgs) {
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

type ImportSettingsDataArgs = {
  event: ChangeEvent<HTMLInputElement>
  setEntries: (entries: Entry[]) => void
  setDiapers: (diapers: DiaperEvent[]) => void
  showToast: (message: string) => void
}

export async function importSettingsData({ event, setEntries, setDiapers, showToast }: ImportSettingsDataArgs) {
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

type ClearSettingsDataArgs = {
  setEntries: (entries: Entry[]) => void
  setDiapers: (diapers: DiaperEvent[]) => void
  setSession: (session: null) => void
  setUndoState: (undoState: null) => void
  showToast: (message: string) => void
}

export function clearSettingsData({ setEntries, setDiapers, setSession, setUndoState, showToast }: ClearSettingsDataArgs) {
  if (!window.confirm('Clear all feeding data? Export a backup first if needed.')) return
  setEntries([])
  setDiapers([])
  setSession(null)
  setUndoState(null)
  showToast('All data cleared')
}

export function openSettingsImportPicker(fileInputRef: RefObject<HTMLInputElement | null>) {
  fileInputRef.current?.click()
}
