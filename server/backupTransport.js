// Credential-free contract only. Deployment injects JSON argv arrays through
// secret configuration; this module never shells out or logs command values.
const parseArgv = (value, name) => {
  if (!value) return null
  let argv
  try { argv = JSON.parse(value) } catch { throw new Error(`${name} must be a JSON array`) }
  if (!Array.isArray(argv) || !argv.every((entry) => typeof entry === 'string' && entry.length)) throw new Error(`${name} must be a JSON array of non-empty strings`)
  return argv
}

export function createBackupTransport({ encryptionArgs = '', uploadArgs = '' } = {}) {
  const encryption = parseArgv(encryptionArgs, 'BACKUP_ENCRYPT_ARGS')
  const upload = parseArgv(uploadArgs, 'BACKUP_UPLOAD_ARGS')
  if (!encryption && !upload) return { status: () => ({ enabled: false, reason: 'disabled' }) }
  if (!encryption || !upload) throw new Error('off-host backup requires both encryption and upload command configuration')
  return {
    status: () => ({ enabled: true, reason: 'configured-not-executed' }),
    encryption,
    upload,
  }
}
