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

export const createNotificationSettingsRouter = ({ config, getGotifyRemindersEnabled, setGotifyRemindersEnabled, writeBooleanSetting, appendEventLog, notificationScheduler }) => {
  const router = (app) => {
    app.get('/api/notification-settings', (_req, res) => {
      res.json({ available: config.notificationChannelsAvailable, gotifyRemindersEnabled: getGotifyRemindersEnabled() })
    })

    app.put('/api/notification-settings', (req, res) => {
      const enabled = Boolean(req.body?.gotifyRemindersEnabled) && config.notificationChannelsAvailable
      setGotifyRemindersEnabled(enabled)
      writeBooleanSetting('gotify_reminders_enabled', enabled)
      appendEventLog('settings_update', { key: 'gotify_reminders_enabled', value: enabled ? '1' : '0' })
      notificationScheduler?.setEnabled(enabled)
      res.json({ ok: true, available: config.notificationChannelsAvailable, gotifyRemindersEnabled: getGotifyRemindersEnabled() })
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
  appendEventLog,
  summarizeState,
  notificationScheduler,
  broadcastStateChange,
  handleStateEvents,
}) => {
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
        growthMeasurements: Array.isArray(req.body?.growthMeasurements) ? req.body.growthMeasurements : [],
        session: req.body?.session ?? null,
        theme: req.body?.theme === 'dark' ? 'dark' : 'light',
        updatedAt: req.body?.updatedAt,
      }, deletedItemOptions())
      const { entries, diapers, medicines, growthMeasurements, session, theme } = incoming
      const updatedAt = new Date().toISOString()

      upsertState.run({
        entries_json: JSON.stringify(entries),
        diapers_json: JSON.stringify(diapers),
        medicines_json: JSON.stringify(medicines),
        growth_measurements_json: JSON.stringify(growthMeasurements),
        session_json: session ? JSON.stringify(session) : null,
        theme,
        updated_at: updatedAt,
      })

      const audit = buildStateAudit(existingRow, { entries, diapers, medicines, growthMeasurements, session, theme }, {
        staleWriteMerged: incoming.stale,
        clientUpdatedAt: req.body?.updatedAt,
        nextUpdatedAt: updatedAt,
      })
      recordDeletedItems(audit, updatedAt)
      appendEventLog('state_write_audit', audit)
      appendEventLog('state_replace', { ...summarizeState(entries, session, theme, diapers, medicines, growthMeasurements), staleWriteMerged: incoming.stale, entries, diapers, medicines, growthMeasurements, session })
      notificationScheduler?.evaluate()

      const responseState = { entries, diapers, medicines, growthMeasurements, session, theme, updatedAt }
      broadcastStateChange(responseState)
      res.json({ ok: true, updatedAt, staleWriteMerged: incoming.stale, state: responseState })
    })
  }
  return router
}
