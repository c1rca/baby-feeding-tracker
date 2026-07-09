import crypto from 'node:crypto'
import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID, DEFAULT_USER_ID } from './database.js'
import { hashPassword, hashSessionToken, verifyPassword } from './authCrypto.js'

export { hashPassword, hashSessionToken, verifyPassword }

const localAuthContext = (mode = 'local') => ({
  userId: DEFAULT_USER_ID,
  householdId: DEFAULT_HOUSEHOLD_ID,
  babyId: DEFAULT_BABY_ID,
  role: 'owner',
  mode,
})

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
export const isEmailAllowed = (email, allowedEmails = []) => {
  const normalized = normalizeEmail(email)
  return normalized.length > 0 && allowedEmails.some((allowed) => normalizeEmail(allowed) === normalized)
}
const defaultTokenFactory = () => globalThis.crypto.randomUUID().replaceAll('-', '')
const defaultIdFactory = () => globalThis.crypto.randomUUID()
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
const isGoogleAuthAvailable = (authRequired, googleAuth = {}) => Boolean(authRequired && googleAuth.clientId && googleAuth.clientSecret && googleAuth.redirectUri)
const defaultGoogleStateFactory = ({ secret, now = () => new Date() }) => {
  const payload = Buffer.from(JSON.stringify({ nonce: defaultTokenFactory(), exp: now().getTime() + 10 * 60 * 1000 })).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}
const defaultGoogleStateVerifier = (state, { secret, now = () => new Date() }) => {
  const [payload, sig] = String(state || '').split('.')
  if (!payload || !sig) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return Number(parsed.exp || 0) >= now().getTime()
  } catch {
    return false
  }
}
const defaultGoogleCodeExchange = async (code, googleAuth) => {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: googleAuth.clientId, client_secret: googleAuth.clientSecret, redirect_uri: googleAuth.redirectUri, grant_type: 'authorization_code' }),
  })
  if (!response.ok) throw new Error('Google token exchange failed')
  return response.json()
}
const defaultGoogleProfileFetch = async (accessToken) => {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new Error('Google profile fetch failed')
  return response.json()
}

const bearerToken = (req) => {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
}

export const createAuthRouter = ({ authRequired = false, googleAuth = {}, allowedEmails = [], selectUserByEmail = null, selectUserByGoogleSub = null, upsertGoogleUser = null, insertSession = null, insertLoginCode = null, selectLoginCode = null, consumeLoginCode = null, selectUserById = null, appendEventLog = () => {}, tokenFactory = defaultTokenFactory, idFactory = defaultIdFactory, stateFactory = null, verifyGoogleState = null, exchangeGoogleCode = defaultGoogleCodeExchange, fetchGoogleProfile = defaultGoogleProfileFetch, now = () => new Date(), maxLoginAttempts = 10, loginWindowMs = 15 * 60 * 1000, loginCodeTtlMs = 60 * 1000 } = {}) => {
  const loginFailures = new Map()
  const failureKey = (req, email) => `${req.ip || req.socket?.remoteAddress || 'unknown'}|${email}`
  const failuresFor = (key) => {
    const record = loginFailures.get(key)
    if (record && now().getTime() - record.firstAt > loginWindowMs) {
      loginFailures.delete(key)
      return null
    }
    return record ?? null
  }

  const createSession = (user) => {
    const createdAt = now()
    const expiresAt = addDays(createdAt, 30)
    const token = tokenFactory()
    insertSession.run({
      id: idFactory(),
      user_id: user.id,
      token_hash: hashSessionToken(token),
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      revoked_at: null,
    })
    return token
  }

  const router = (app) => {
    app.post('/api/auth/login', (req, res) => {
      if (!authRequired) {
        res.status(404).json({ ok: false, error: 'Authentication is not enabled' })
        return
      }

      const email = normalizeEmail(req.body?.email)
      const password = String(req.body?.password || '')
      const key = failureKey(req, email)
      if ((failuresFor(key)?.count ?? 0) >= maxLoginAttempts) {
        appendEventLog('auth_login_rate_limited', { email })
        res.status(429).json({ ok: false, error: 'Too many login attempts. Try again later.' })
        return
      }

      const user = email ? selectUserByEmail?.get(email) : null
      if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
        const record = failuresFor(key)
        if (record) record.count += 1
        else loginFailures.set(key, { count: 1, firstAt: now().getTime() })
        res.status(401).json({ ok: false, error: 'Invalid email or password' })
        return
      }
      loginFailures.delete(key)

      const token = createSession(user)
      appendEventLog('auth_login', { userId: user.id })
      res.status(200).json({
        ok: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
        },
      })
    })

    app.get('/api/auth/google/status', (req, res) => {
      res.status(200).json({ ok: true, available: isGoogleAuthAvailable(authRequired, googleAuth) })
    })

    app.get('/api/auth/google/start', (req, res) => {
      if (!isGoogleAuthAvailable(authRequired, googleAuth)) {
        res.status(404).json({ ok: false, error: 'Google sign-in is not enabled' })
        return
      }
      const state = stateFactory ? stateFactory() : defaultGoogleStateFactory({ secret: googleAuth.clientSecret, now })
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('client_id', googleAuth.clientId)
      url.searchParams.set('redirect_uri', googleAuth.redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'openid email profile')
      url.searchParams.set('state', state)
      url.searchParams.set('prompt', 'select_account')
      res.redirect(302, url.toString())
    })

    app.get('/api/auth/google/callback', async (req, res) => {
      if (!isGoogleAuthAvailable(authRequired, googleAuth)) {
        res.redirect(302, '/?auth_error=google_unavailable')
        return
      }
      const code = String(req.query?.code || '')
      const state = String(req.query?.state || '')
      const stateOk = verifyGoogleState ? verifyGoogleState(state) : defaultGoogleStateVerifier(state, { secret: googleAuth.clientSecret, now })
      if (!code || !stateOk) {
        res.redirect(302, '/?auth_error=google_state')
        return
      }
      try {
        const tokenPayload = await exchangeGoogleCode(code, googleAuth)
        const profile = await fetchGoogleProfile(tokenPayload.access_token)
        const email = normalizeEmail(profile.email)
        if (!profile.sub || !email || profile.email_verified === false) {
          res.redirect(302, '/?auth_error=google_profile')
          return
        }
        const existingBySub = selectUserByGoogleSub?.get(profile.sub)
        const existingByEmail = existingBySub ? null : selectUserByEmail?.get(email)
        const existingUser = existingBySub || existingByEmail
        // A brand-new account may only be created for an allow-listed email, and
        // even then it gets no household/membership — no account auto-becomes an
        // owner of the shared household. Onboarding (P1) grants a household later.
        if (!existingUser && !isEmailAllowed(email, allowedEmails)) {
          appendEventLog('auth_google_denied', { email })
          res.redirect(302, '/?auth_error=not_invited')
          return
        }
        const user = existingUser || { id: idFactory(), email, display_name: profile.name || email }
        upsertGoogleUser?.run({
          id: user.id,
          email,
          display_name: profile.name || user.display_name || email,
          google_sub: profile.sub,
          created_at: now().toISOString(),
        })
        // Hand the browser a short-lived, single-use code in the URL *fragment*
        // (never sent to the server, so it stays out of access logs/referrers).
        // The SPA exchanges it for the real session token via POST.
        const handoffCode = tokenFactory()
        insertLoginCode?.run({
          code_hash: hashSessionToken(handoffCode),
          user_id: user.id,
          created_at: now().toISOString(),
          expires_at: new Date(now().getTime() + loginCodeTtlMs).toISOString(),
        })
        appendEventLog('auth_google_login', { userId: user.id })
        res.redirect(302, `/#auth_code=${encodeURIComponent(handoffCode)}`)
      } catch (error) {
        appendEventLog('auth_google_error', { error: error?.message || 'Google sign-in failed' })
        res.redirect(302, '/?auth_error=google_failed')
      }
    })

    app.post('/api/auth/google/exchange', (req, res) => {
      if (!authRequired) {
        res.status(404).json({ ok: false, error: 'Authentication is not enabled' })
        return
      }
      const code = String(req.body?.code || '')
      if (!code) {
        res.status(400).json({ ok: false, error: 'Missing code' })
        return
      }
      const codeHash = hashSessionToken(code)
      const row = selectLoginCode?.get(codeHash)
      if (!row || row.consumed_at || new Date(row.expires_at).getTime() < now().getTime()) {
        res.status(401).json({ ok: false, error: 'Invalid or expired code' })
        return
      }
      // Single-use is enforced at the write: only the first exchange flips
      // consumed_at, so a replayed code updates zero rows and is rejected.
      const consumed = consumeLoginCode?.run({ code_hash: codeHash, consumed_at: now().toISOString() })
      if (consumed && consumed.changes === 0) {
        res.status(401).json({ ok: false, error: 'Invalid or expired code' })
        return
      }
      const token = createSession({ id: row.user_id })
      const user = selectUserById?.get(row.user_id)
      appendEventLog('auth_google_exchange', { userId: row.user_id })
      res.status(200).json({
        ok: true,
        token,
        user: user ? { id: user.id, email: user.email, displayName: user.display_name } : { id: row.user_id },
      })
    })
  }
  return router
}

export const createAuthSessionRouter = ({ revokeSession = null, revokeOtherUserSessions = null, selectUserById = null, updateUserPassword = null, appendEventLog = () => {}, now = () => new Date() } = {}) => {
  const router = (app) => {
    app.get('/api/auth/me', (req, res) => {
      const auth = req.auth || localAuthContext()
      res.status(200).json({
        ok: true,
        user: {
          id: auth.userId,
          householdId: auth.householdId,
          babyId: auth.babyId,
          role: auth.role,
          mode: auth.mode,
        },
      })
    })

    app.post('/api/auth/password', (req, res) => {
      const auth = req.auth || localAuthContext()
      if (auth.mode !== 'session') {
        res.status(404).json({ ok: false, error: 'Authentication is not enabled' })
        return
      }
      const currentPassword = String(req.body?.currentPassword || '')
      const newPassword = String(req.body?.newPassword || '')
      if (newPassword.length < 12) {
        res.status(400).json({ ok: false, error: 'New password must be at least 12 characters' })
        return
      }
      const user = selectUserById?.get(auth.userId)
      if (!user?.password_hash || !verifyPassword(currentPassword, user.password_hash)) {
        res.status(401).json({ ok: false, error: 'Current password is incorrect' })
        return
      }
      const updatedAt = now().toISOString()
      updateUserPassword?.run({ user_id: auth.userId, password_hash: hashPassword(newPassword), updated_at: updatedAt })
      revokeOtherUserSessions?.run({ user_id: auth.userId, token_hash: auth.tokenHash || '', revoked_at: updatedAt })
      appendEventLog('auth_password_changed', { userId: auth.userId })
      res.status(200).json({ ok: true })
    })

    app.post('/api/auth/logout', (req, res) => {
      const auth = req.auth || localAuthContext()
      if (auth.tokenHash) {
        revokeSession?.run({ token_hash: auth.tokenHash, revoked_at: now().toISOString() })
        appendEventLog('auth_logout', { userId: auth.userId })
      }
      res.status(200).json({ ok: true })
    })
  }
  return router
}

const requestedBabyId = (req) => String(req.headers?.['x-baby-id'] || req.headers?.['X-Baby-Id'] || '').trim()

export const createAuthMiddleware = ({ authRequired = false, authBypass = false, selectSessionContext = null, selectBabyForHousehold = null } = {}) => (req, res, next) => {
  if (authBypass) {
    req.auth = localAuthContext('auth-bypass')
    next()
    return
  }
  if (!authRequired) {
    req.auth = localAuthContext()
    next()
    return
  }

  const token = bearerToken(req)
  if (!token) {
    res.status(401).json({ ok: false, error: 'Authentication required' })
    return
  }

  const tokenHash = hashSessionToken(token)
  const row = selectSessionContext?.get(tokenHash)
  if (!row) {
    res.status(401).json({ ok: false, error: 'Invalid or expired session' })
    return
  }

  const babyOverride = requestedBabyId(req)
  const babyId = babyOverride || row.baby_id || DEFAULT_BABY_ID
  if (babyOverride && selectBabyForHousehold && !selectBabyForHousehold.get(babyId, row.household_id)) {
    res.status(404).json({ ok: false, error: 'Baby not found' })
    return
  }

  req.auth = {
    userId: row.user_id,
    householdId: row.household_id,
    babyId,
    role: row.role,
    mode: 'session',
    tokenHash,
  }
  next()
}
