import path from 'node:path'
import { normalizeTextEmailRecipients } from './notifications.js'

export function createRuntimeConfig({ env = process.env, rootDir }) {
  const port = Number(env.PORT || 8080)
  const dbDir = env.DB_DIR || path.join(rootDir, 'data')
  const dbPath = env.DB_PATH || path.join(dbDir, 'feeding-tracker.db')
  const backupDir = env.BACKUP_DIR || path.join(dbDir, 'backups')
  const logDir = env.LOG_DIR || path.join(dbDir, 'logs')
  const eventLogPath = path.join(logDir, 'feeding-tracker-events.jsonl')
  const gotifyUrl = env.GOTIFY_URL || ''
  const gotifyToken = env.GOTIFY_TOKEN || ''
  const smtpHost = env.SMTP_HOST || 'smtp.gmail.com'
  const smtpPort = Number(env.SMTP_PORT || 465)
  const smtpUser = env.SMTP_USER || ''
  const smtpPassword = env.SMTP_PASSWORD || ''
  const textEmailTo = normalizeTextEmailRecipients(env.TEXT_EMAIL_TO)
  const textEmailFrom = env.TEXT_EMAIL_FROM || smtpUser
  const textEmailAvailable = Boolean(smtpUser && smtpPassword && textEmailTo.length > 0 && textEmailFrom)
  const gotifyAvailable = Boolean(gotifyUrl && gotifyToken)
  const notificationChannelsAvailable = gotifyAvailable || textEmailAvailable
  const notificationsDefaultEnabled = env.NOTIFICATIONS_ENABLED === '1' && notificationChannelsAvailable
  const authRequired = env.AUTH_REQUIRED === '1'
  const authBypass = env.AUTH_BYPASS === '1'
  // Production must never boot without auth. ALLOW_INSECURE_LOCAL_MODE is the
  // deliberate, explicit escape hatch for local diagnostics against a
  // prod-like NODE_ENV; it is never set in the deployed environment.
  if (env.NODE_ENV === 'production' && env.ALLOW_INSECURE_LOCAL_MODE !== '1') {
    if (!authRequired) {
      throw new Error('AUTH_REQUIRED must be 1 in production (set ALLOW_INSECURE_LOCAL_MODE=1 to override for local diagnostics)')
    }
    if (authBypass) {
      throw new Error('AUTH_BYPASS must not be enabled in production (set ALLOW_INSECURE_LOCAL_MODE=1 to override for local diagnostics)')
    }
  }
  const googleAuth = {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: env.GOOGLE_REDIRECT_URI || '',
  }
  // Beta gate: only these emails may create a brand-new account. Empty = signup
  // closed (existing users always authenticate regardless of this list).
  const allowedEmails = String(env.AUTH_ALLOWED_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  // Phone beta gate: only these E.164 numbers may self-provision a new phone
  // account. Empty = new-phone provisioning closed (existing phone users can
  // still request codes). Same 10/11-digit normalization the auth router uses.
  const normalizeAllowedPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
    if (String(value || '').trim().startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`
    return ''
  }
  const allowedPhones = String(env.AUTH_ALLOWED_PHONES || '')
    .split(',')
    .map((entry) => normalizeAllowedPhone(entry))
    .filter(Boolean)
  const bootstrapPassword = env.AUTH_BOOTSTRAP_PASSWORD || ''
  const isProduction = env.NODE_ENV === 'production'
  // Number of proxy hops to trust for req.ip (so rate-limit keys use the real
  // client IP, not the reverse proxy's). Empty = don't trust any proxy.
  const trustProxy = env.TRUST_PROXY || ''
  const publicBaseUrl = String(env.PUBLIC_BASE_URL || env.APP_BASE_URL || '').replace(/\/$/, '')
  const textLoginSmsDomain = String(env.TEXT_LOGIN_SMS_DOMAIN || '').trim()
  const textLoginAvailable = textEmailAvailable

  return {
    port,
    dbDir,
    dbPath,
    backupDir,
    logDir,
    eventLogPath,
    gotifyUrl,
    gotifyToken,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    textEmailTo,
    textEmailFrom,
    textEmailAvailable,
    gotifyAvailable,
    notificationChannelsAvailable,
    notificationsDefaultEnabled,
    authRequired,
    authBypass,
    googleAuth,
    allowedEmails,
    allowedPhones,
    bootstrapPassword,
    isProduction,
    trustProxy,
    publicBaseUrl,
    textLoginSmsDomain,
    textLoginAvailable,
  }
}
