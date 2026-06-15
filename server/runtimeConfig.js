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
  }
}
