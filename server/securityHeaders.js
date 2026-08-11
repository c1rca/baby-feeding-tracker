// Hand-rolled security headers (no extra dependency). The app is a same-origin
// SPA that talks only to its own API, so a tight self-only policy holds.

// The one documented exception is the action backup log, which by design lives
// off-origin so it survives this server. Widening connect-src is the whole
// point of the setting, so it is opt-in per deployment and never a wildcard:
// an unset ACTION_LOG_ORIGIN leaves the policy exactly as strict as before.
const actionLogOrigin = (env) => {
  const raw = (env.ACTION_LOG_ORIGIN || '').trim()
  if (!raw) return ''
  try {
    // Normalising to an origin drops any path, and rejects a value that is not
    // a URL at all, so a malformed setting cannot smuggle extra CSP directives
    // in through the semicolon.
    return new URL(raw).origin
  } catch {
    return ''
  }
}

const buildContentSecurityPolicy = (env = process.env) => {
  const logOrigin = actionLogOrigin(env)
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    // React/Tailwind apply inline style attributes; scripts stay external-only.
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    logOrigin ? `connect-src 'self' ${logOrigin}` : "connect-src 'self'",
  ].join('; ')
}

export const contentSecurityPolicyFor = buildContentSecurityPolicy

export const createSecurityHeaders = ({ hsts = false, env = process.env } = {}) => (_req, res, next) => {
  res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(env))
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  // Only pin HSTS in production (over HTTPS); pinning it on a localhost http
  // origin would be ignored anyway but is avoided for clarity.
  if (hsts) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  next()
}
