import crypto from 'node:crypto'

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
