import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID } from './database.js'
import { hashSessionToken } from './authCrypto.js'
import { normalizeMedicineReminderSettings } from './notificationModels.js'
import { validateStatePayload } from './stateValidation.js'

const normalizeTummyGoalMinutes = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 20
  return Math.min(240, Math.max(1, Math.round(numeric)))
}

const canMutate = (auth) => auth?.role !== 'viewer'
const rejectForbidden = (res) => res.status(403).json({ ok: false, error: 'Insufficient permissions' })

export const createHealthRouter = ({ checkDatabaseReady = () => true } = {}) => {
  const router = (app) => {
    app.get('/api/health', (_req, res) => {
      if (!checkDatabaseReady()) {
        res.status(503).json({ ok: false })
        return
      }
      res.json({ ok: true })
    })
  }
  return router
}

export const createDiagnosticsRouter = ({ config, getGotifyRemindersEnabled }) => {
  const router = (app) => {
    app.get('/api/diagnostics', (_req, res) => {
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
      // Reminder settings and the delivery channel are effectively shared admin
      // config (today a single global channel), so only an owner may change
      // them. Local/bypass mode resolves to role 'owner', so it is unaffected.
      if (req.auth?.role !== 'owner') {
        rejectForbidden(res)
        return
      }
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
      if (!canMutate(req.auth)) {
        rejectForbidden(res)
        return
      }
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
      if (!canMutate(req.auth)) {
        rejectForbidden(res)
        return
      }
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

const isValidDob = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (String(value || '').trim().startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`
  return ''
}
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
const invitePayload = (row) => ({ id: row.id, email: row.email, role: row.role, createdAt: row.created_at, expiresAt: row.expires_at })
const memberPayload = (row) => ({ userId: row.user_id, email: row.email, displayName: row.display_name, role: row.role, createdAt: row.created_at })

export const createMemberRouter = ({ selectMembersByHousehold = null, updateMemberRole = null, removeMember = null, appendEventLog = () => {} } = {}) => {
  const requireOwner = (req, res) => {
    if (req.auth?.role !== 'owner' || !req.auth?.householdId) {
      rejectForbidden(res)
      return false
    }
    return true
  }
  const router = (app) => {
    app.get('/api/household-members', (req, res) => {
      if (!req.auth?.householdId) {
        res.status(403).json({ ok: false, error: 'Household required' })
        return
      }
      const members = selectMembersByHousehold?.all(req.auth.householdId).map(memberPayload) || []
      res.status(200).json({ ok: true, members })
    })

    app.patch('/api/household-members/:userId', (req, res) => {
      if (!requireOwner(req, res)) return
      const userId = String(req.params?.userId || '')
      const role = String(req.body?.role || '').trim()
      if (!['caregiver', 'viewer'].includes(role)) {
        res.status(400).json({ ok: false, error: 'Role must be caregiver or viewer' })
        return
      }
      const result = updateMemberRole?.run({ household_id: req.auth.householdId, user_id: userId, role }) || { changes: 0 }
      if (!result.changes) {
        res.status(404).json({ ok: false, error: 'Member not found' })
        return
      }
      appendEventLog('member_role_update', { householdId: req.auth.householdId, targetUserId: userId, role, userId: req.auth.userId })
      res.status(200).json({ ok: true })
    })

    app.delete('/api/household-members/:userId', (req, res) => {
      if (!requireOwner(req, res)) return
      const userId = String(req.params?.userId || '')
      if (userId === req.auth.userId) {
        res.status(400).json({ ok: false, error: 'Cannot remove yourself' })
        return
      }
      const result = removeMember?.run({ household_id: req.auth.householdId, user_id: userId }) || { changes: 0 }
      if (!result.changes) {
        res.status(404).json({ ok: false, error: 'Member not found' })
        return
      }
      appendEventLog('member_remove', { householdId: req.auth.householdId, targetUserId: userId, userId: req.auth.userId })
      res.status(200).json({ ok: true })
    })
  }
  return router
}

export const createInviteRouter = ({ selectActiveInvitesByHousehold = null, selectInviteByEmail = null, insertInvite = null, revokeInvite = null, appendEventLog = () => {}, sendInvite = null, baseUrl = '', idFactory = () => globalThis.crypto.randomUUID(), tokenFactory = () => globalThis.crypto.randomUUID().replaceAll('-', ''), now = () => new Date() } = {}) => {
  const router = (app) => {
    app.get('/api/household-invites', (req, res) => {
      if (!req.auth?.householdId) {
        res.status(403).json({ ok: false, error: 'Household required' })
        return
      }
      const invites = selectActiveInvitesByHousehold?.all(req.auth.householdId).map(invitePayload) || []
      res.status(200).json({ ok: true, invites })
    })

    app.post('/api/household-invites', async (req, res) => {
      if (!canMutate(req.auth) || !req.auth?.householdId) {
        rejectForbidden(res)
        return
      }
      const rawDestination = String(req.body?.email || req.body?.destination || '')
      const phone = normalizePhone(rawDestination)
      const email = phone || normalizeEmail(rawDestination)
      const channel = phone ? 'text' : 'email'
      const role = String(req.body?.role || 'caregiver').trim()
      if (!email) {
        res.status(400).json({ ok: false, error: 'Enter an email or mobile number' })
        return
      }
      if (!['caregiver', 'viewer'].includes(role)) {
        res.status(400).json({ ok: false, error: 'Invite role must be caregiver or viewer' })
        return
      }
      if (selectInviteByEmail?.get(req.auth.householdId, email)) {
        res.status(409).json({ ok: false, error: 'invite_exists' })
        return
      }
      const createdAt = now()
      const token = tokenFactory()
      const row = {
        id: idFactory(),
        household_id: req.auth.householdId,
        email,
        role,
        token_hash: hashSessionToken(token),
        created_by: req.auth.userId,
        created_at: createdAt.toISOString(),
        expires_at: addDays(createdAt, 7).toISOString(),
        accepted_at: null,
        revoked_at: null,
      }
      const linkBaseUrl = String(baseUrl || `${req.protocol || 'http'}://${req.get?.('host') || 'localhost'}`).replace(/\/$/, '')
      const link = `${linkBaseUrl}/?invite=${encodeURIComponent(token)}`
      try {
        if (sendInvite) await sendInvite({ channel, to: email, link, role })
      } catch {
        res.status(502).json({ ok: false, error: `Could not deliver invite by ${channel}` })
        return
      }
      insertInvite?.run(row)
      appendEventLog('invite_create', { inviteId: row.id, householdId: row.household_id, email, role, createdBy: req.auth.userId })
      res.status(201).json({ ok: true, invite: { ...invitePayload(row), token } })
    })

    app.delete('/api/household-invites/:id', (req, res) => {
      if (!canMutate(req.auth) || !req.auth?.householdId) {
        rejectForbidden(res)
        return
      }
      const payload = { id: String(req.params?.id || ''), household_id: req.auth.householdId, revoked_at: now().toISOString() }
      const result = revokeInvite?.run(payload) || { changes: 0 }
      if (!result.changes) {
        res.status(404).json({ ok: false, error: 'Invite not found' })
        return
      }
      appendEventLog('invite_revoke', { inviteId: payload.id, householdId: payload.household_id, userId: req.auth.userId })
      res.status(200).json({ ok: true })
    })
  }
  return router
}

export const createHouseholdRouter = ({ selectMembershipsByUser = null, createHousehold = null, appendEventLog = () => {}, idFactory = () => globalThis.crypto.randomUUID(), now = () => new Date() } = {}) => {
  const router = (app) => {
    app.post('/api/households', (req, res) => {
      const auth = req.auth
      if (auth?.mode !== 'session') {
        res.status(403).json({ ok: false, error: 'Authentication required' })
        return
      }
      // Beta rule: a user belongs to exactly one household, so onboarding is a
      // one-time action. Already-provisioned users get a 409.
      const memberships = selectMembershipsByUser?.all(auth.userId) || []
      if (memberships.length > 0) {
        res.status(409).json({ ok: false, error: 'already_in_household' })
        return
      }
      const householdName = String(req.body?.householdName || '').trim() || 'My household'
      const babyName = String(req.body?.babyName || '').trim()
      const babyDob = String(req.body?.babyDob || '').trim()
      if (!babyName) {
        res.status(400).json({ ok: false, error: 'Baby name is required' })
        return
      }
      if (!isValidDob(babyDob)) {
        res.status(400).json({ ok: false, error: 'Baby date of birth must use YYYY-MM-DD' })
        return
      }

      const householdId = idFactory()
      const babyId = idFactory()
      const createdAt = now().toISOString()
      createHousehold({ userId: auth.userId, householdId, householdName, babyId, babyName, babyDob, createdAt })
      appendEventLog('household_create', { householdId, babyId, userId: auth.userId })
      res.status(201).json({
        ok: true,
        household: { id: householdId, name: householdName },
        baby: { id: babyId, householdId, name: babyName, dob: babyDob },
      })
    })
  }
  return router
}

export const createStateRouter = ({
  selectState,
  upsertState,
  selectStateForBaby = null,
  upsertStateForBaby = null,
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
  selectBabyForHousehold = null,
}) => {
  const isDefaultScope = (statePayload) => statePayload.household_id === DEFAULT_HOUSEHOLD_ID && statePayload.baby_id === DEFAULT_BABY_ID
  const persistStateAndDeletedItems = writeStateAndDeletedItems ?? ((statePayload, audit, updatedAt) => {
    if (upsertStateForBaby) {
      upsertStateForBaby.run(statePayload)
      // The legacy single row keeps mirroring the default baby so pre-scoping
      // builds (and a prod rollback) still read current data.
      if (isDefaultScope(statePayload)) upsertState.run(statePayload)
    } else {
      upsertState.run(statePayload)
    }
    recordDeletedItems(audit, updatedAt, { householdId: statePayload.household_id, babyId: statePayload.baby_id })
  })
  const router = (app) => {
    const requestScope = (req, existingRow = null) => ({
      householdId: req.auth?.householdId || existingRow?.household_id || DEFAULT_HOUSEHOLD_ID,
      babyId: req.auth?.babyId || existingRow?.baby_id || DEFAULT_BABY_ID,
    })
    const selectScopedState = (scope) => selectStateForBaby ? selectStateForBaby.get(scope.householdId, scope.babyId) : selectState.get()

    app.get('/api/state', (req, res) => {
      res.set('Cache-Control', 'no-store')
      const scope = requestScope(req)
      if (selectBabyForHousehold && !selectBabyForHousehold.get(scope.babyId, scope.householdId)) {
        res.status(404).json({ ok: false, error: 'Baby not found' })
        return
      }
      res.json({ ...serializeState(selectScopedState(scope)), householdId: scope.householdId, babyId: scope.babyId })
    })

    app.get('/api/state/events', handleStateEvents)

    app.put('/api/state', (req, res) => {
      if (!canMutate(req.auth)) {
        rejectForbidden(res)
        return
      }
      const validation = validateStatePayload(req.body)
      if (!validation.ok) {
        res.status(400).json({ ok: false, error: validation.error })
        return
      }
      const existingRow = selectScopedState(requestScope(req))
      const scope = requestScope(req, existingRow)
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
      }, deletedItemOptions(scope))
      const { entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme } = incoming
      if (selectBabyForHousehold && !selectBabyForHousehold.get(scope.babyId, scope.householdId)) {
        res.status(404).json({ ok: false, error: 'Baby not found' })
        return
      }
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
      // Log only the summary (counts + latest IDs) and the audit's add/update/
      // remove IDs — never the full private baby records. DB backups are the
      // recovery path; event-log replay granularity is reduced accordingly.
      appendEventLog('state_replace', { ...summarizeState(entries, session, theme, diapers, medicines, growthMeasurements, babyDob, tummyTimes, tummySession), staleWriteMerged: incoming.stale })
      notificationScheduler?.evaluate()

      const responseState = { entries, diapers, medicines, tummyTimes, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme, updatedAt }
      broadcastStateChange(responseState, scope)
      res.json({ ok: true, updatedAt, staleWriteMerged: incoming.stale, state: responseState })
    })
  }
  return router
}
