import { CLIENT_ID } from '../sync/clientId'
import { KEY_PENDING_SYNC, KEY_PENDING_SYNC_BABY } from '../sync/serverSyncTypes'
import { readClientErrors, type ClientError } from './errorLog'

/**
 * Everything this device knows, packaged for someone reading it later.
 *
 * The point is reconstruction: the local tracker state is included in full, so
 * a record that never reached the server can be recovered from the bundle even
 * if the failure that lost it was never journalled.
 */
export type Diagnostics = {
  at: string
  clientId: string
  babyId: string | null
  app: { url: string; userAgent: string; language: string; online: boolean; standalone: boolean }
  sync: { pendingSyncRaw: string | null; pendingSyncBaby: string | null }
  localState: Record<string, unknown>
  localStateKeys: string[]
  errors: ClientError[]
}

// The tracker's own local records, which are what a reconstruction would draw
// from. Everything else in localStorage is preference noise.
const STATE_KEY_PREFIXES = ['baby-feeding-tracker']

const readJsonKey = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    try { return JSON.parse(raw) } catch { return raw }
  } catch {
    return null
  }
}

export function collectDiagnostics(babyId: string | null): Diagnostics {
  const keys: string[] = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && STATE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key)
    }
  } catch {
    // Storage unavailable; the rest of the bundle is still worth sending.
  }

  const localState: Record<string, unknown> = {}
  for (const key of keys) {
    // Skip the error log itself — it travels as `errors`, already parsed.
    if (key.endsWith('client-errors')) continue
    localState[key] = readJsonKey(key)
  }

  return {
    at: new Date().toISOString(),
    clientId: CLIENT_ID,
    babyId,
    app: {
      url: typeof location === 'undefined' ? '' : location.href,
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      language: typeof navigator === 'undefined' ? '' : navigator.language,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      standalone: typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true,
    },
    sync: {
      pendingSyncRaw: (() => { try { return localStorage.getItem(KEY_PENDING_SYNC) } catch { return null } })(),
      pendingSyncBaby: (() => { try { return localStorage.getItem(KEY_PENDING_SYNC_BABY) } catch { return null } })(),
    },
    localState,
    localStateKeys: keys,
    errors: readClientErrors(),
  }
}
