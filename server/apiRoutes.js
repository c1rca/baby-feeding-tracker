import { DEFAULT_BABY_ID, DEFAULT_BABY_DOB, DEFAULT_HOUSEHOLD_ID } from './database.js'
import { hashSessionToken } from './authCrypto.js'
import { normalizeMedicineReminderSettings, normalizeNotificationPreferences } from './notificationModels.js'
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

export const createNotificationSettingsRouter = ({ config, getGotifyRemindersEnabled, setGotifyRemindersEnabled, getMedicineReminderSettings, setMedicineReminderSettings, getNotificationPreferences = () => normalizeNotificationPreferences(), setNotificationPreferences = () => {}, getHouseholdNotificationSettings = null, setHouseholdNotificationSettings = null, writeBooleanSetting, writeJsonSetting, appendEventLog, notificationScheduler }) => {
  const legacySettings = () => ({
    gotifyRemindersEnabled: getGotifyRemindersEnabled(),
    medicineReminderSettings: getMedicineReminderSettings(),
    notificationPreferences: getNotificationPreferences(),
  })
  const settingsFor = (req) => getHouseholdNotificationSettings?.(req.auth?.householdId || DEFAULT_HOUSEHOLD_ID) ?? legacySettings()
  const settingsPayload = (req) => ({ available: config.notificationChannelsAvailable, ...settingsFor(req) })
  const router = (app) => {
    app.get('/api/notification-settings', (req, res) => {
      res.json(settingsPayload(req))
    })

    app.put('/api/notification-settings', (req, res) => {
      if (req.auth?.role !== 'owner') {
        rejectForbidden(res)
        return
      }
      const householdId = req.auth?.householdId || DEFAULT_HOUSEHOLD_ID
      const current = settingsFor(req)
      const eventScope = setHouseholdNotificationSettings ? { householdId } : {}
      const next = { ...current }
      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'gotifyRemindersEnabled')) {
        next.gotifyRemindersEnabled = Boolean(req.body?.gotifyRemindersEnabled) && config.notificationChannelsAvailable
        appendEventLog('settings_update', { ...eventScope, key: 'gotify_reminders_enabled', value: next.gotifyRemindersEnabled ? '1' : '0' })
      }
      if (req.body?.medicineReminderSettings) {
        next.medicineReminderSettings = normalizeMedicineReminderSettings(req.body.medicineReminderSettings)
        appendEventLog('settings_update', { ...eventScope, key: 'medicine_reminder_settings', value: next.medicineReminderSettings })
      }
      if (req.body?.notificationPreferences) {
        next.notificationPreferences = normalizeNotificationPreferences(req.body.notificationPreferences)
        appendEventLog('settings_update', { ...eventScope, key: 'notification_preferences', value: next.notificationPreferences })
      }
      if (setHouseholdNotificationSettings) {
        setHouseholdNotificationSettings(householdId, next)
        notificationScheduler?.evaluate()
      } else {
        if (next.gotifyRemindersEnabled !== current.gotifyRemindersEnabled) {
          setGotifyRemindersEnabled(next.gotifyRemindersEnabled)
          writeBooleanSetting('gotify_reminders_enabled', next.gotifyRemindersEnabled)
          notificationScheduler?.setEnabled(next.gotifyRemindersEnabled)
        }
        if (next.medicineReminderSettings !== current.medicineReminderSettings) {
          setMedicineReminderSettings(next.medicineReminderSettings)
          writeJsonSetting('medicine_reminder_settings', next.medicineReminderSettings)
          notificationScheduler?.evaluate()
        }
        if (next.notificationPreferences !== current.notificationPreferences) {
          setNotificationPreferences(next.notificationPreferences)
          writeJsonSetting('notification_preferences', next.notificationPreferences)
          notificationScheduler?.evaluate()
        }
      }
      res.json({ ok: true, ...settingsPayload(req) })
    })
  }
  return router
}

export const createBabyRouter = ({ selectBabiesByHousehold = null, selectBabyForHousehold = null, insertBaby = null, insertEmptyBabyState = null, renameBaby = null, updateBabyProfile = null, archiveBaby = null, appendEventLog = () => {}, idFactory = () => globalThis.crypto.randomUUID(), now = () => new Date() } = {}) => {
  const toBabyPayload = (row) => ({
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    dob: row.dob,
    sex: row.sex ?? null,
    birthWeightLb: row.birth_weight_lb ?? null,
    birthLengthCm: row.birth_length_cm ?? null,
    pediatricianName: row.pediatrician_name ?? null,
    pediatricianPhone: row.pediatrician_phone ?? null,
    photo: row.photo ?? null,
    archivedAt: row.archived_at ?? null,
  })
  const BABY_SEXES = new Set(['female', 'male'])
  // Avatars arrive already downscaled by the browser; the server re-checks the
  // shape and ceiling rather than trusting that. '' clears the photo.
  const MAX_PHOTO_BYTES = 64 * 1024
  const validPhoto = (value) => {
    if (value === '') return true
    if (typeof value !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return false
    return Math.floor((value.slice(value.indexOf(',') + 1).length * 3) / 4) <= MAX_PHOTO_BYTES
  }
  // Absent means "leave unchanged"; an explicit empty string means "clear".
  const optionalText = (value, max) => {
    if (value === undefined) return undefined
    const text = String(value).trim()
    return text ? text.slice(0, max) : null
  }
  const optionalNumber = (value) => {
    if (value === undefined) return undefined
    if (value === null || value === '') return null
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : Number.NaN
  }
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
      // Seed an empty state row carrying the baby's real DOB so age/growth math is
      // correct from the first render, rather than defaulting until the first PUT.
      insertEmptyBabyState?.run({ household_id: householdId, baby_id: row.id, baby_dob: dob, updated_at: row.created_at })
      appendEventLog('baby_create', { babyId: row.id, householdId, userId: req.auth?.userId ?? null })
      res.status(201).json({ ok: true, baby: toBabyPayload(row) })
    })

    app.patch('/api/babies/:id', (req, res) => {
      if (!canMutate(req.auth)) {
        rejectForbidden(res)
        return
      }
      const householdId = req.auth?.householdId || DEFAULT_HOUSEHOLD_ID
      const babyId = String(req.params?.id || '').trim()
      const body = req.body ?? {}
      // Name has always been required on PATCH and stays that way; the profile
      // fields are all optional and only touched when present.
      const name = String(body.name || '').trim()
      if (!name) {
        res.status(400).json({ ok: false, error: 'Baby name is required' })
        return
      }
      if (body.dob !== undefined && !validDob(body.dob)) {
        res.status(400).json({ ok: false, error: 'Baby date of birth must use YYYY-MM-DD' })
        return
      }
      const sex = optionalText(body.sex, 10)
      if (sex !== undefined && sex !== null && !BABY_SEXES.has(sex)) {
        res.status(400).json({ ok: false, error: 'Baby sex must be female or male' })
        return
      }
      if (body.photo !== undefined && !validPhoto(body.photo)) {
        res.status(400).json({ ok: false, error: 'Baby photo must be a small JPEG, PNG, or WebP data URL' })
        return
      }
      const birthWeightLb = optionalNumber(body.birthWeightLb)
      const birthLengthCm = optionalNumber(body.birthLengthCm)
      if (Number.isNaN(birthWeightLb) || Number.isNaN(birthLengthCm)) {
        res.status(400).json({ ok: false, error: 'Birth measurements must be non-negative numbers' })
        return
      }

      const patch = {
        id: babyId,
        household_id: householdId,
        name,
        dob: body.dob === undefined ? null : String(body.dob),
        sex: sex === undefined ? null : sex,
        birth_weight_lb: birthWeightLb === undefined ? null : birthWeightLb,
        birth_length_cm: birthLengthCm === undefined ? null : birthLengthCm,
        pediatrician_name: optionalText(body.pediatricianName, 200) ?? null,
        pediatrician_phone: optionalText(body.pediatricianPhone, 40) ?? null,
        photo: body.photo === undefined ? null : body.photo,
      }
      const result = (updateBabyProfile ?? renameBaby)?.run(updateBabyProfile ? patch : { id: babyId, household_id: householdId, name }) || { changes: 0 }
      if (!result.changes) {
        res.status(404).json({ ok: false, error: 'Baby not found' })
        return
      }
      appendEventLog('baby_rename', { babyId, householdId, userId: req.auth?.userId ?? null })
      const updated = selectBabyForHousehold?.get(babyId, householdId)
      res.status(200).json({ ok: true, baby: updated ? toBabyPayload(updated) : { id: babyId, name } })
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
      if (req.auth?.role !== 'owner' || !req.auth?.householdId) {
        rejectForbidden(res)
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
      if (req.auth?.role !== 'owner' || !req.auth?.householdId) {
        rejectForbidden(res)
        return
      }
      const invites = selectActiveInvitesByHousehold?.all(req.auth.householdId).map(invitePayload) || []
      res.status(200).json({ ok: true, invites })
    })

    app.post('/api/household-invites', async (req, res) => {
      if (req.auth?.role !== 'owner' || !req.auth?.householdId) {
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
      const link = `${linkBaseUrl}/#invite=${encodeURIComponent(token)}`
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
      if (req.auth?.role !== 'owner' || !req.auth?.householdId) {
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


/**
 * Receives the client's journal of writes that never reached the server.
 *
 * Nothing here interprets or applies the payloads — they go straight to the
 * append-only backup log. Recovery is a deliberate act performed against that
 * log, not something a debug upload should trigger on its own.
 */
export const createDebugLogRouter = ({ forwardActionLog = null } = {}) => (app) => {
  app.post('/api/debug-logs', (req, res) => {
    if (!canMutate(req.auth)) {
      rejectForbidden(res)
      return
    }
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : null
    const diagnostics = req.body?.diagnostics && typeof req.body.diagnostics === 'object' ? req.body.diagnostics : null
    if (!entries && !diagnostics) {
      res.status(400).json({ ok: false, error: 'entries must be an array' })
      return
    }
    if ((entries?.length ?? 0) > 500) {
      res.status(413).json({ ok: false, error: 'too many entries in one upload' })
      return
    }
    if (!forwardActionLog) {
      // Be honest rather than pretend: reporting success would let the client
      // clear a journal nothing has stored.
      res.status(503).json({ ok: false, error: 'no backup log configured' })
      return
    }

    const householdId = req.auth?.householdId ?? null
    const babyId = req.auth?.babyId ?? null

    // The device's whole local record, kept so a missing entry can be restored
    // from it by hand later. Stored verbatim; nothing here is applied.
    if (diagnostics) {
      forwardActionLog({
        action: 'client.diagnostics',
        at: typeof diagnostics.at === 'string' ? diagnostics.at : new Date().toISOString(),
        householdId,
        babyId: diagnostics.babyId ?? babyId,
        clientId: diagnostics.clientId ?? req.headers?.['x-client-id'] ?? null,
        counts: { errors: Array.isArray(diagnostics.errors) ? diagnostics.errors.length : 0, localStateKeys: Array.isArray(diagnostics.localStateKeys) ? diagnostics.localStateKeys.length : 0 },
        diagnostics,
        state: diagnostics.localState ?? null,
      })
    }

    const accepted = []
    for (const entry of entries ?? []) {
      if (!entry || typeof entry !== 'object') continue
      forwardActionLog({
        action: 'client.send-failure',
        at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
        householdId,
        babyId: entry.babyId ?? babyId,
        clientId: entry.clientId ?? req.headers?.['x-client-id'] ?? null,
        counts: entry.counts ?? {},
        reason: entry.reason ?? null,
        httpStatus: entry.status ?? null,
        state: entry.payload ?? null,
      })
      if (Number.isInteger(entry.id)) accepted.push(entry.id)
    }
    res.json({ ok: true, received: entries?.length ?? 0, diagnostics: Boolean(diagnostics), accepted })
  })
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
  notificationScheduler,
  broadcastStateChange,
  handleStateEvents,
  selectBabyForHousehold = null,
  forwardActionLog = null,
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
      // When the client omits babyDob on a first write, fall back to this baby's
      // real DOB from the babies row (its source of truth) — not a global constant.
      const fallbackBabyDob = existingRow?.baby_dob || selectBabyForHousehold?.get(scope.babyId, scope.householdId)?.dob || DEFAULT_BABY_DOB
      const syncIntentOptions = req.body?.syncIntents && typeof req.body.syncIntents === 'object'
        ? {
            ...(req.body.syncIntents.deletes ? { deleteIntents: req.body.syncIntents.deletes } : {}),
            ...(req.body.syncIntents.restores ? { restoreIntents: req.body.syncIntents.restores } : {}),
          }
        : {}
      const incoming = resolveIncomingState(existingRow, {
        entries: Array.isArray(req.body?.entries) ? req.body.entries : [],
        diapers: Array.isArray(req.body?.diapers) ? req.body.diapers : [],
        medicines: Array.isArray(req.body?.medicines) ? req.body.medicines : [],
        tummyTimes: Array.isArray(req.body?.tummyTimes) ? req.body.tummyTimes : [],
        pumpEvents: Array.isArray(req.body?.pumpEvents) ? req.body.pumpEvents : [],
        pumpSession: req.body?.pumpSession ?? null,
        tummySession: req.body?.tummySession ?? null,
        tummyGoalMinutes: normalizeTummyGoalMinutes(req.body?.tummyGoalMinutes),
        pumpGoalOunces: Number.isInteger(req.body?.pumpGoalOunces) && req.body.pumpGoalOunces >= 0 ? Math.min(500, req.body.pumpGoalOunces) : 0,
        pumpGoalSessions: Number.isInteger(req.body?.pumpGoalSessions) && req.body.pumpGoalSessions >= 0 ? Math.min(50, req.body.pumpGoalSessions) : 0,
        growthMeasurements: Array.isArray(req.body?.growthMeasurements) ? req.body.growthMeasurements : [],
        healthRecords: Array.isArray(req.body?.healthRecords) ? req.body.healthRecords : [],
        customTrackers: Array.isArray(req.body?.customTrackers) ? req.body.customTrackers : [],
        customEvents: Array.isArray(req.body?.customEvents) ? req.body.customEvents : [],
        babyDob: typeof req.body?.babyDob === 'string' ? req.body.babyDob : fallbackBabyDob,
        session: req.body?.session ?? null,
        theme: req.body?.theme === 'dark' ? 'dark' : 'light',
        updatedAt: req.body?.updatedAt,
      }, {
        ...deletedItemOptions(scope),
        ...syncIntentOptions,
      })
      const { entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, customTrackers, customEvents, babyDob, session, theme } = incoming
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
        pump_events_json: JSON.stringify(pumpEvents),
        pump_session_json: pumpSession ? JSON.stringify(pumpSession) : null,
        tummy_session_json: tummySession ? JSON.stringify(tummySession) : null,
        tummy_goal_minutes: tummyGoalMinutes,
        pump_goal_ounces: pumpGoalOunces,
        pump_goal_sessions: pumpGoalSessions,
        growth_measurements_json: JSON.stringify(growthMeasurements),
        health_records_json: JSON.stringify(healthRecords),
        custom_trackers_json: JSON.stringify(customTrackers),
        custom_events_json: JSON.stringify(customEvents),
        baby_dob: babyDob,
        session_json: session ? JSON.stringify(session) : null,
        theme,
        updated_at: updatedAt,
      }

      const audit = buildStateAudit(existingRow, { entries, diapers, medicines, tummyTimes, pumpEvents, tummySession, tummyGoalMinutes, growthMeasurements, babyDob, session, theme }, {
        staleWriteMerged: incoming.stale,
        clientUpdatedAt: req.body?.updatedAt,
        nextUpdatedAt: updatedAt,
      })
      persistStateAndDeletedItems(statePayload, audit, updatedAt, req.body?.syncIntents?.restores)
      notificationScheduler?.evaluate()

      const responseState = { entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, growthMeasurements, healthRecords, customTrackers, customEvents, babyDob, session, theme, updatedAt }
      broadcastStateChange(responseState, scope, req.headers?.['x-client-id'] || null)
      // Back up what actually landed, from the server, so every device is
      // covered. Fire-and-forget by contract: this must never delay the
      // caregiver's response or turn a log outage into a failed write.
      forwardActionLog?.({
        action: 'state.write',
        at: updatedAt,
        householdId: scope.householdId,
        babyId: scope.babyId,
        clientId: req.headers?.['x-client-id'] || null,
        counts: {
          entries: entries?.length ?? 0,
          diapers: diapers?.length ?? 0,
          medicines: medicines?.length ?? 0,
          tummyTimes: tummyTimes?.length ?? 0,
          pumpEvents: pumpEvents?.length ?? 0,
          growthMeasurements: growthMeasurements?.length ?? 0,
          healthRecords: healthRecords?.length ?? 0,
          customTrackers: customTrackers?.length ?? 0,
          customEvents: customEvents?.length ?? 0,
        },
        state: responseState,
      })
      res.json({ ok: true, updatedAt, staleWriteMerged: incoming.stale, state: responseState })
    })
  }
  return router
}
