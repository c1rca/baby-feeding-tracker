import { normalizeMedicineReminderSettings } from './notificationModels.js'

const normalizeTummyGoalMinutes = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 20
  return Math.min(240, Math.max(1, Math.round(numeric)))
}

export const createHealthRouter = ({ config, getGotifyRemindersEnabled }) => {
  const router = (app) => {
    app.get('/api/health', (_req, res) => {
      res.json({
        ok: true,
        dbPath: config.dbPath,
        notificationsAvailable: config.notificationChannelsAvailable,
        gotifyAvailable: config.gotifyAvailable,
        textEmailAvailable: config.textEmailAvailable,
        gotifyRemindersEnabled: getGotifyRemindersEnabled(),
      })
    })
  }
  return router
}

export const createNotificationSettingsRouter = ({ config, getGotifyRemindersEnabled, setGotifyRemindersEnabled, getMedicineReminderSettings, setMedicineReminderSettings, writeBooleanSetting, writeJsonSetting, appendEventLog, notificationScheduler }) => {
  const settingsPayload = () => ({
    available: config.notificationChannelsAvailable,
    gotifyRemindersEnabled: getGotifyRemindersEnabled(),
    medicineReminderSettings: getMedicineReminderSettings(),
  })
  const router = (app) => {
    app.get('/api/notification-settings', (_req, res) => {
      res.json(settingsPayload())
    })

    app.put('/api/notification-settings', (req, res) => {
      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'gotifyRemindersEnabled')) {
        const enabled = Boolean(req.body?.gotifyRemindersEnabled) && config.notificationChannelsAvailable
        setGotifyRemindersEnabled(enabled)
        writeBooleanSetting('gotify_reminders_enabled', enabled)
        appendEventLog('settings_update', { key: 'gotify_reminders_enabled', value: enabled ? '1' : '0' })
        notificationScheduler?.setEnabled(enabled)
      }
      if (req.body?.medicineReminderSettings) {
        const nextSettings = normalizeMedicineReminderSettings(req.body.medicineReminderSettings)
        setMedicineReminderSettings(nextSettings)
        writeJsonSetting('medicine_reminder_settings', nextSettings)
        appendEventLog('settings_update', { key: 'medicine_reminder_settings', value: nextSettings })
        notificationScheduler?.evaluate()
      }
      res.json({ ok: true, ...settingsPayload() })
    })
  }
  return router
}

export const createStateRouter = ({
  selectState,
  upsertState,
  serializeState,
  resolveIncomingState,
  deletedItemOptions,
  buildStateAudit,
  recordDeletedItems,
  writeStateAndDeletedItems,
  appendEventLog,
  summarizeState,
  notificationScheduler,
  broadcastStateChange,
  handleStateEvents,
}) => {
  const persistStateAndDeletedItems = writeStateAndDeletedItems ?? ((statePayload, audit, updatedAt) => {
    upsertState.run(statePayload)
    recordDeletedItems(audit, updatedAt)
  })
  const router = (app) => {
    app.get('/api/state', (_req, res) => {
      res.set('Cache-Control', 'no-store')
      res.json(serializeState(selectState.get()))
    })

    app.get('/api/state/events', handleStateEvents)

    app.put('/api/state', (req, res) => {
      const existingRow = selectState.get()
      const incoming = resolveIncomingState(existingRow, {
        entries: Array.isArray(req.body?.entries) ? req.body.entries : [],
        diapers: Array.isArray(req.body?.diapers) ? req.body.diapers : [],
        medicines: Array.isArray(req.body?.medicines) ? req.body.medicines : [],
        tummyTimes: Array.isArray(req.body?.tummyTimes) ? req.body.tummyTimes : [],
        tummySession: req.body?.tummySession ?? null,
        tummyGoalMinutes: normalizeTummyGoalMinutes(req.body?.tummyGoalMinutes),
        growthMeasurements: Array.isArray(req.body?.growthMeasurements) ? req.body.growthMeasurements : [],
        babyDob: typeof req.body?.babyDob === 'string' ? req.body.babyDob : '2026-06-03',
        session: req.body?.session ?? null,
        theme: req.body?.theme === 'dark' ? 'dark' : 'light',
        updatedAt: req.body?.updatedAt,
      }, deletedItemOptions())
      const { entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme } = incoming
      const updatedAt = new Date().toISOString()

      const statePayload = {
        entries_json: JSON.stringify(entries),
        diapers_json: JSON.stringify(diapers),
        medicines_json: JSON.stringify(medicines),
        tummy_times_json: JSON.stringify(tummyTimes),
        tummy_session_json: tummySession ? JSON.stringify(tummySession) : null,
        tummy_goal_minutes: tummyGoalMinutes,
        growth_measurements_json: JSON.stringify(growthMeasurements),
        baby_dob: babyDob,
        session_json: session ? JSON.stringify(session) : null,
        theme,
        updated_at: updatedAt,
      }

      const audit = buildStateAudit(existingRow, { entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme }, {
        staleWriteMerged: incoming.stale,
        clientUpdatedAt: req.body?.updatedAt,
        nextUpdatedAt: updatedAt,
      })
      persistStateAndDeletedItems(statePayload, audit, updatedAt)
      appendEventLog('state_write_audit', audit)
      appendEventLog('state_replace', { ...summarizeState(entries, session, theme, diapers, medicines, growthMeasurements, babyDob, tummyTimes, tummySession), staleWriteMerged: incoming.stale, entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session })
      notificationScheduler?.evaluate()

      const responseState = { entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme, updatedAt }
      broadcastStateChange(responseState)
      res.json({ ok: true, updatedAt, staleWriteMerged: incoming.stale, state: responseState })
    })
  }
  return router
}
