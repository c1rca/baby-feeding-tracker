import { authFetch } from '../auth/authSession'
import { CLIENT_ID } from '../sync/clientId'
import { collectDiagnostics } from './diagnostics'
import { clearClientErrors } from './errorLog'
import { clearDelivered, readJournal } from './failureJournal'

// Full-state payloads are large, so hand them over in batches rather than one
// request the server may refuse outright.
const BATCH = 25

export type DebugUploadResult =
  | { ok: true; sent: number; remaining: number; diagnosticsSent: boolean }
  | { ok: false; error: string; sent: number; remaining: number; diagnosticsSent: boolean }

/**
 * Upload the journal of failed writes, clearing only what the server confirms.
 *
 * An entry is deleted locally only when its id comes back in `accepted`. A
 * partial upload therefore leaves the rest on the device: the whole point is
 * that nothing is dropped on the assumption it arrived.
 */
export async function sendDebugLogs(babyId: string | null = null): Promise<DebugUploadResult> {
  const journal = await readJournal()

  // Always send a diagnostic snapshot, even with an empty journal. The whole
  // local record travels with it, so a caregiver who noticed something missing
  // can have it recovered from the bundle whether or not the loss ever
  // surfaced as a failed write.
  let diagnosticsSent: boolean
  try {
    const response = await authFetch('/api/debug-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID },
      body: JSON.stringify({ entries: [], diagnostics: collectDiagnostics(babyId) }),
    })
    diagnosticsSent = response.ok
    if (response.ok) clearClientErrors()
    if (!response.ok) {
      const remaining = (await readJournal()).length
      const error = response.status === 503
        ? 'The server has no backup log configured, so nothing was stored.'
        : `The server refused the upload (${response.status}). Nothing was cleared from this device.`
      return { ok: false, error, sent: 0, remaining, diagnosticsSent: false }
    }
  } catch {
    return { ok: false, error: 'Could not reach the server. Everything is still saved on this device.', sent: 0, remaining: journal.length, diagnosticsSent: false }
  }

  if (journal.length === 0) return { ok: true, sent: 0, remaining: 0, diagnosticsSent }

  let sent = 0
  for (let index = 0; index < journal.length; index += BATCH) {
    const batch = journal.slice(index, index + BATCH)
    let response: Response
    try {
      response = await authFetch('/api/debug-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID },
        body: JSON.stringify({ entries: batch }),
      })
    } catch {
      const remaining = (await readJournal()).length
      return { ok: false, error: 'Could not reach the server. The logs are still saved on this device.', sent, remaining, diagnosticsSent }
    }
    if (!response.ok) {
      const remaining = (await readJournal()).length
      const error = response.status === 503
        ? 'The server has no backup log configured, so nothing was stored. The logs are still on this device.'
        : `The server refused the upload (${response.status}). The logs are still on this device.`
      return { ok: false, error, sent, remaining, diagnosticsSent }
    }
    const body = await response.json().catch(() => null) as { accepted?: number[] } | null
    const accepted = Array.isArray(body?.accepted) ? body!.accepted : []
    await clearDelivered(accepted)
    sent += accepted.length
  }

  const remaining = (await readJournal()).length
  return { ok: true, sent, remaining, diagnosticsSent }
}
