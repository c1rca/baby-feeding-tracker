import nodemailer from 'nodemailer'
import { createNotificationScheduler, sendGotifyMessage } from './notifications.js'

export const createTextEmailSender = (config) => {
  if (!config.textEmailAvailable) return null

  const smtpTransporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPassword },
  })

  return async ({ subject, title, message, to }) => {
    await smtpTransporter.sendMail({
      from: config.textEmailFrom,
      to: to || config.textEmailTo,
      subject: subject || title || 'Feedr reminder',
      text: message,
    })
  }
}

export const createTrackerNotificationScheduler = ({ config, selectState, selectAllStates = null, getNotificationState, upsertNotificationState, gotifyRemindersEnabled, getMedicineReminderSettings, appendEventLog, redactError }) => {
  if (!config.notificationChannelsAvailable) return null

  const sendTextEmailMessage = createTextEmailSender(config)

  return createNotificationScheduler({
    selectState,
    selectAllStates,
    getNotificationState,
    upsertNotificationState,
    sendGotify: config.gotifyAvailable
      ? async (payload) => {
          appendEventLog('gotify_send_attempt', { title: payload.title, message: payload.message, priority: payload.priority })
          try {
            await sendGotifyMessage({ url: config.gotifyUrl, token: config.gotifyToken, ...payload })
            appendEventLog('gotify_send_success', { title: payload.title, message: payload.message, priority: payload.priority })
          } catch (error) {
            appendEventLog('gotify_send_failed', { title: payload.title, message: payload.message, priority: payload.priority, error: redactError(error) })
            throw error
          }
        }
      : null,
    sendTextEmail: sendTextEmailMessage
      ? async (payload) => {
          appendEventLog('text_email_send_attempt', { subject: payload.subject || payload.title, to: config.textEmailTo })
          try {
            await sendTextEmailMessage(payload)
            appendEventLog('text_email_send_success', { subject: payload.subject || payload.title, to: config.textEmailTo })
          } catch (error) {
            appendEventLog('text_email_send_failed', { subject: payload.subject || payload.title, to: config.textEmailTo, error: redactError(error) })
            throw error
          }
        }
      : null,
    enabled: gotifyRemindersEnabled,
    getMedicineReminderSettings,
  })
}
