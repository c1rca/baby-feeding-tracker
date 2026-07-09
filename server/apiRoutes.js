import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID } from './database.js'
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

export const createBabyRouter = ({ selectBabiesByHousehold = null, insertBaby = null, archiveBaby = null, appendEventLog = () => {}, idFactory = () => globalThis.crypto.randomUUID(), now = () => new Date() } = {}) => {
  const toBabyPayload = (row) => ({
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    dob: row.dob,
    archivedAt: row.archived_at ?? null,
  })
  const validDob = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))

  const router = (app) => {
    app.get('/api/babies', (req, res) => {
      const householdId = req.auth?.householdId || DEFAULT_HOUSEHOLD_ID
      const babies = selectBabiesByHousehold?.all(householdId).map(toBabyPayload) || []
      res.status(200).json({ ok: true, babies })
    })

    app.post('/api/babies', (req, res) => {
      const householdId = req.auth?.householdId || DEFAULT_HOUSEHOLD_ID
      const name = String(req.body?.name || '').trim()
      const dob = String(req.body?.dob || '').trim()
      if (!name) {
        res.status(400).json({ ok: false, error: 'Baby name is required' })
        return
      }
      if (!validDob(dob)) {
        res.status(400).json({ ok: false, error: 'Baby date of birth must use YYYY-MM-DD' })
        return
      }

      const row = {
        id: idFactory(),
        household_id: householdId,
        name,
        dob,
        archived_at: null,
        created_at: now().toISOString(),
      }
      insertBaby?.run(row)
      appendEventLog('baby_create', { babyId: row.id, householdId, userId: req.auth?.userId ?? null })
      res.status(201).json({ ok: true, baby: toBabyPayload(row) })
    })

    app.delete('/api/babies/:id', (req, res) => {
      const householdId = req.auth?.householdId || DEFAULT_HOUSEHOLD_ID
      const babyId = String(req.params?.id || '').trim()
      const archivedAt = now().toISOString()
      const result = archiveBaby?.run({ id: babyId, household_id: householdId, archived_at: archivedAt }) || { changes: 0 }
      if (!result.changes) {
        res.status(404).json({ ok: false, error: 'Baby not found' })
        return
      }
      appendEventLog('baby_archive', { babyId, householdId, userId: req.auth?.userId ?? null })
      res.status(200).json({ ok: true })
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
    const requestScope = (req, existingRow = null) => ({
      householdId: req.auth?.householdId || existingRow?.household_id || DEFAULT_HOUSEHOLD_ID,
      babyId: req.auth?.babyId || existingRow?.baby_id || DEFAULT_BABY_ID,
    })

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
      const scope = requestScope(req, existingRow)
      const updatedAt = new Date().toISOString()

      const statePayload = {
        household_id: scope.householdId,
        baby_id: scope.babyId,
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
