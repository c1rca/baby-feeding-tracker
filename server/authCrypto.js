import crypto from 'node:crypto'

export const hashSessionToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex')

// Login codes are short (6 digits), so a plain SHA-256 of the code is trivially
// reversible from a DB leak by precomputing all 10^6 hashes. Keying the hash with
// a server-side pepper (kept in env/config, never in the DB) makes that infeasible
// without also compromising the app secret. With no pepper configured we fall back
// to the plain hash so local/dev deploys keep working; production should set one.
export const hashLoginCode = (code, pepper = '') =>
  pepper
    ? crypto.createHmac('sha256', String(pepper)).update(String(code)).digest('hex')
    : hashSessionToken(code)

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
