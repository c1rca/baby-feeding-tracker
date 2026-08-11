// Credential-free contract only. Deployment injects JSON argv arrays through
// secret configuration; this module never goes through a shell and never logs
// command values — they carry recipients, hostnames and paths.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const parseArgv = (value, name) => {
  if (!value) return null
  let argv
  try { argv = JSON.parse(value) } catch { throw new Error(`${name} must be a JSON array`) }
  if (!Array.isArray(argv) || !argv.every((entry) => typeof entry === 'string' && entry.length)) throw new Error(`${name} must be a JSON array of non-empty strings`)
  return argv
}

/** Placeholders the deployment's argv may use; everything else passes through verbatim. */
const ARTIFACT = '{{artifact}}'
const OUTPUT = '{{output}}'
export const BACKUP_TRANSPORT_PLACEHOLDERS = { ARTIFACT, OUTPUT }

const substitute = (argv, values) => argv.map((entry) => entry.split(ARTIFACT).join(values.artifact).split(OUTPUT).join(values.output))

// No shell, so nothing in the configured argv can be interpreted as syntax.
// Bounded, because a hung upload must not hold a backup run open forever.
const run = (argv, timeoutMs) => new Promise((resolve) => {
  const [command, ...args] = argv
  execFile(command, args, { timeout: timeoutMs, windowsHide: true }, (error) => {
    resolve(error ? { ok: false, code: typeof error.code === 'number' ? error.code : null } : { ok: true })
  })
})

export function createBackupTransport({ encryptionArgs = '', uploadArgs = '', timeoutMs = 120_000 } = {}) {
  const encryption = parseArgv(encryptionArgs, 'BACKUP_ENCRYPT_ARGS')
  const upload = parseArgv(uploadArgs, 'BACKUP_UPLOAD_ARGS')
  if (!encryption && !upload) {
    return {
      status: () => ({ enabled: false, reason: 'disabled' }),
      ship: async () => ({ shipped: false, reason: 'disabled' }),
    }
  }
  // Refusing half a configuration is the point: an upload with no encryption
  // would put the family's complete record on someone else's disk in the clear.
  if (!encryption || !upload) throw new Error('off-host backup requires both encryption and upload command configuration')

  /**
   * Encrypt the verified artifact, then hand it to the upload command.
   *
   * Never throws. The local artifact is already written and verified by the time
   * this runs, and it is the copy a restore actually uses — a broken remote has
   * to degrade to "we still have it here", never to a failed backup run.
   */
  const ship = async (artifactPath) => {
    if (!artifactPath || !fs.existsSync(artifactPath)) return { shipped: false, reason: 'artifact missing' }
    // Scratch space outside the backup directory, so an encrypted intermediate
    // is never mistaken for a managed artifact or swept up by retention.
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feeding-offhost-'))
    const output = path.join(scratchDir, `${path.basename(artifactPath)}.enc`)
    const values = { artifact: artifactPath, output }
    try {
      const encrypted = await run(substitute(encryption, values), timeoutMs)
      if (!encrypted.ok) return { shipped: false, reason: `encryption command failed (exit ${encrypted.code})` }
      if (!fs.existsSync(output) || fs.statSync(output).size === 0) return { shipped: false, reason: 'encryption produced no output' }

      const uploaded = await run(substitute(upload, values), timeoutMs)
      if (!uploaded.ok) return { shipped: false, reason: `upload command failed (exit ${uploaded.code})` }
      return { shipped: true, bytes: fs.statSync(output).size }
    } catch (error) {
      return { shipped: false, reason: error instanceof Error ? error.message : 'off-host shipping failed' }
    } finally {
      fs.rmSync(scratchDir, { recursive: true, force: true })
    }
  }

  return { status: () => ({ enabled: true, reason: 'configured' }), encryption, upload, ship }
}

/** A transport that is present but inert, for callers with none configured. */
export const NO_BACKUP_TRANSPORT = {
  status: () => ({ enabled: false, reason: 'disabled' }),
  ship: async () => ({ shipped: false, reason: 'disabled' }),
}
