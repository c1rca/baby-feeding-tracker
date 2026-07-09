import crypto from 'node:crypto'
import { DEFAULT_BABY_ID, DEFAULT_HOUSEHOLD_ID, DEFAULT_USER_ID } from './database.js'

const localAuthContext = () => ({
  userId: DEFAULT_USER_ID,
  householdId: DEFAULT_HOUSEHOLD_ID,
  babyId: DEFAULT_BABY_ID,
  role: 'owner',
  mode: 'local',
})

export const hashSessionToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex')

const PASSWORD_ALGORITHM = 'scrypt'
const PASSWORD_KEY_LENGTH = 64

export const hashPassword = (password, { salt = crypto.randomBytes(16).toString('hex') } = {}) => {
  const key = crypto.scryptSync(String(password), salt, PASSWORD_KEY_LENGTH).toString('hex')
  return `${PASSWORD_ALGORITHM}$${salt}$${key}`
}

export const verifyPassword = (password, storedHash) => {
  const [algorithm, salt, expected] = String(storedHash || '').split('$')
  if (algorithm !== PASSWORD_ALGORITHM || !salt || !expected) return false
  const actual = crypto.scryptSync(String(password), salt, PASSWORD_KEY_LENGTH)
  const expectedBuffer = Buffer.from(expected, 'hex')
  return expectedBuffer.length === actual.length && crypto.timingSafeEqual(actual, expectedBuffer)
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const defaultTokenFactory = () => crypto.randomBytes(32).toString('base64url')
const defaultIdFactory = () => crypto.randomUUID()
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)

const bearerToken = (req) => {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
}

export const createAuthRouter = ({ authRequired = false, selectUserByEmail = null, insertSession = null, appendEventLog = () => {}, tokenFactory = defaultTokenFactory, idFactory = defaultIdFactory, now = () => new Date() } = {}) => {
  const router = (app) => {
    app.post('/api/auth/login', (req, res) => {
      if (!authRequired) {
        res.status(404).json({ ok: false, error: 'Authentication is not enabled' })
        return
      }

      const email = normalizeEmail(req.body?.email)
      const password = String(req.body?.password || '')
      const user = email ? selectUserByEmail?.get(email) : null
      if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ ok: false, error: 'Invalid email or password' })
        return
      }

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

  const row = selectSessionContext?.get(hashSessionToken(token))
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
  }
  next()
}
