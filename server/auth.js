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

const bearerToken = (req) => {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
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
