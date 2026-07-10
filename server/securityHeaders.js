// Hand-rolled security headers (no extra dependency). The app is a same-origin
// SPA that talks only to its own API, so a tight self-only policy holds.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // React/Tailwind apply inline style attributes; scripts stay external-only.
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
].join('; ')

export const createSecurityHeaders = ({ hsts = false } = {}) => (_req, res, next) => {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  // Only pin HSTS in production (over HTTPS); pinning it on a localhost http
  // origin would be ignored anyway but is avoided for clarity.
  if (hsts) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  next()
}
