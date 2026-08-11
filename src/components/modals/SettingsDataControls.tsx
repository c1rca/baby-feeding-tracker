import { useEffect, useState, type ChangeEvent, type RefObject } from 'react'
import { Download, LifeBuoy, Printer, Trash2, Upload } from 'lucide-react'
import { SettingsRow, SettingsSection } from './settings/SettingsPrimitives'
import type { TrackerExportState } from '../../state/trackerStateExport'
import { clearSettingsData, exportDailySummaryCsv, exportEventsCsv, exportSettingsData, importSettingsData, openCareReport, openSettingsImportPicker } from './settingsDataActions'
import { useUnits } from '../../state/unitPreferencesContext'
import { journalSize } from '../../logging/failureJournal'
import { sendDebugLogs } from '../../logging/sendDebugLogs'

type SettingsDataControlsProps = TrackerExportState & {
  fileInputRef: RefObject<HTMLInputElement | null>
  selectedBabyId?: string | null
  babyName?: string
  babyProfile?: Parameters<typeof openCareReport>[0]['babyProfile']
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

export function SettingsDataControls(props: SettingsDataControlsProps) {
  const { fileInputRef, showToast, babyName, babyProfile, ...stateAndSetters } = props
  const { units } = useUnits()
  const state: TrackerExportState = {
    entries: props.entries, diapers: props.diapers, medicines: props.medicines, tummyTimes: props.tummyTimes, pumpEvents: props.pumpEvents,
    pumpSession: props.pumpSession, tummySession: props.tummySession, tummyGoalMinutes: props.tummyGoalMinutes, pumpGoalOunces: props.pumpGoalOunces, pumpGoalSessions: props.pumpGoalSessions, growthMeasurements: props.growthMeasurements,
    healthRecords: props.healthRecords, babyDob: props.babyDob, session: props.session, theme: props.theme,
  }
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => { void importSettingsData({ event, ...stateAndSetters, showToast }) }

  // Anything this device tried to send and could not. Normally zero, which is
  // why the row says so plainly rather than hiding itself — "nothing pending"
  // is the reassuring answer to the question this row exists to answer.
  const [pending, setPending] = useState<{ entries: number; bytes: number } | null>(null)
  const [sending, setSending] = useState(false)
  const refreshPending = () => { void journalSize().then(setPending).catch(() => setPending(null)) }
  useEffect(refreshPending, [])

  const handleSendDebugLogs = async () => {
    setSending(true)
    const result = await sendDebugLogs(props.selectedBabyId ?? null)
    setSending(false)
    refreshPending()
    if (result.ok) {
      showToast(result.sent === 0
        ? 'Diagnostics sent — this device had no unsent changes'
        : `Diagnostics sent, plus ${result.sent} unsent ${result.sent === 1 ? 'record' : 'records'}`)
    } else {
      showToast(result.error)
    }
  }
  const pendingLabel = pending === null
    ? 'Checking this device…'
    : pending.entries === 0
      ? 'Nothing pending — every change on this device reached the server.'
      : `${pending.entries} ${pending.entries === 1 ? 'change' : 'changes'} (${Math.max(1, Math.round(pending.bytes / 1024))} KB) never reached the server and are held on this device.`


  return (
    <>
      <SettingsSection label="Take it with you" lead="Everything below reads this device's copy of the log. None of it changes what the server holds.">
        <div className="settings-card">
          <SettingsRow
            title="Care summary for appointments"
            hint="A printable day-by-day summary of the last 30 days, plus growth and medicine detail. Save it as a PDF or hand it to a pediatrician."
            control={<button aria-label="Open printable care summary" onClick={() => openCareReport({ state, units, babyName, babyProfile, showToast })}><Printer size={16} /> Open</button>}
          />
          <SettingsRow
            title="Spreadsheet export"
            hint="CSV for your own analysis — every logged event, or one row per day for the last 30 days. Amounts use your selected units."
            control={(
              <>
                <button aria-label="Export events CSV" onClick={() => exportEventsCsv({ state, units, babyName, showToast })}>Events</button>
                <button aria-label="Export daily summary CSV" onClick={() => exportDailySummaryCsv({ state, units, babyName, babyProfile, showToast })}>Daily</button>
              </>
            )}
          />
        </div>
      </SettingsSection>

      <SettingsSection label="Backup & restore" lead="A complete copy of this baby's local data: feeds, diapers, medicines, tummy time, pumping, growth, active timers, birth date, goals and theme.">
        <div className="settings-card">
          <SettingsRow
            title="Backup to a file"
            hint="Saves one JSON file you can keep anywhere."
            control={<button aria-label="Export JSON" onClick={() => exportSettingsData({ state, showToast })}><Download size={16} /> Export</button>}
          />
          <SettingsRow
            title="Restore from a file"
            hint="Replaces this device's data with the file's contents. You will be asked to confirm first."
            control={<button aria-label="Import JSON" onClick={() => openSettingsImportPicker(fileInputRef)}><Upload size={16} /> Import</button>}
          />
        </div>
      </SettingsSection>

      <SettingsSection label="Diagnostics">
        <div className="settings-card">
          <SettingsRow
            title="Unsent changes"
            hint={<>{pendingLabel} Sending hands this device's full local record, recent errors and anything unsent to the server's backup log, so missing entries can be restored from it.</>}
            control={<button aria-label="Send debug logs to server" disabled={sending} onClick={() => void handleSendDebugLogs()}><LifeBuoy size={16} /> {sending ? 'Sending…' : 'Send'}</button>}
          />
        </div>
      </SettingsSection>

      <SettingsSection label="Danger zone">
        <div className="settings-card is-danger">
          <SettingsRow
            tone="danger"
            title="Clear local health data"
            hint="Removes every feed, diaper, medicine, tummy time, pumping and growth record held on this device, plus any running timer. Birth date, goals and theme are kept. Back up first if you might want any of it."
            /* Kept on a blocking confirm rather than the armed two-step used
               elsewhere: this destroys data irreversibly, and a modal is the
               stronger guard. The armed button is for reversible removals. */
            control={<button className="danger" aria-label="Clear all data" onClick={() => clearSettingsData({ ...stateAndSetters, showToast })}><Trash2 size={16} /> Clear data</button>}
          />
        </div>
      </SettingsSection>

      <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={handleImport} />
    </>
  )
}
