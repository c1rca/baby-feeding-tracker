import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID, DEFAULT_USER_ID } from './database.js'
import { hashPassword, hashSessionToken, verifyPassword } from './authCrypto.js'

export { hashPassword, hashSessionToken, verifyPassword }

const localAuthContext = () => ({
  userId: DEFAULT_USER_ID,
  householdId: DEFAULT_HOUSEHOLD_ID,
  babyId: DEFAULT_BABY_ID,
  role: 'owner',
  mode: 'local',
})

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const defaultTokenFactory = () => globalThis.crypto.randomUUID().replaceAll('-', '')
const defaultIdFactory = () => globalThis.crypto.randomUUID()
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)

const bearerToken = (req) => {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
}

export const createAuthRouter = ({ authRequired = false, selectUserByEmail = null, insertSession = null, appendEventLog = () => {}, tokenFactory = defaultTokenFactory, idFactory = defaultIdFactory, now = () => new Date(), maxLoginAttempts = 10, loginWindowMs = 15 * 60 * 1000 } = {}) => {
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
  }
  return router
}

export const createAuthSessionRouter = ({ revokeSession = null, appendEventLog = () => {}, now = () => new Date() } = {}) => {
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

export const createAuthMiddleware = ({ authRequired = false, selectSessionContext = null } = {}) => (req, res, next) => {
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

  req.auth = {
    userId: row.user_id,
    householdId: row.household_id,
    babyId: row.baby_id || DEFAULT_BABY_ID,
    role: row.role,
    mode: 'session',
    tokenHash,
  }
  next()
}
