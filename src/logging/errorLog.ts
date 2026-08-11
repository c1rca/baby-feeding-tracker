/**
 * A rolling record of what went wrong on this device.
 *
 * Errors are small, so this lives in localStorage rather than IndexedDB — it
 * survives a reload and a crash, which is when it is worth having. The failed
 * *writes* live in the IndexedDB journal instead, because those carry full
 * state payloads.
 */
import { recordSendFailure } from './failureJournal'

const KEY = 'baby-feeding-tracker:v1:client-errors'
const MAX_ENTRIES = 200
const MAX_MESSAGE = 2000

export type ClientError = {
  at: string
  kind: 'error' | 'unhandledrejection' | 'console'
  message: string
  stack?: string
  url?: string
}

const read = (): ClientError[] => {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const write = (entries: ClientError[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // A full quota must not turn error reporting into a second error.
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-Math.floor(MAX_ENTRIES / 4)))) } catch { /* give up quietly */ }
  }
}

const clip = (value: unknown) => String(value ?? '').slice(0, MAX_MESSAGE)

export function recordClientError(entry: Omit<ClientError, 'at'>): void {
  const logged = { ...entry, at: new Date().toISOString(), message: clip(entry.message), stack: entry.stack ? clip(entry.stack) : undefined }
  const entries = read()
  entries.push(logged)
  write(entries)
  void recordSendFailure({ at: logged.at, kind: 'state-snapshot', reason: `client.${logged.kind}`, status: null, babyId: null, clientId: 'error-log', counts: {}, payload: logged })
}

export const readClientErrors = (): ClientError[] => read()
export const clearClientErrors = (): void => { /* local error history is append-only */ }

/**
 * Start capturing. Wraps console.error as well as the window handlers, because
 * plenty of failures in this app are caught and logged rather than thrown, and
 * those are exactly the ones worth seeing after the fact.
 */
export function installErrorCapture(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onError = (event: ErrorEvent) => {
    recordClientError({ kind: 'error', message: event.message, stack: event.error?.stack, url: `${event.filename ?? ''}:${event.lineno ?? 0}` })
  }
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    recordClientError({ kind: 'unhandledrejection', message: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined })
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  const original = console.error
  console.error = (...args: unknown[]) => {
    try {
      recordClientError({ kind: 'console', message: args.map((arg) => (arg instanceof Error ? `${arg.message}\n${arg.stack ?? ''}` : typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ') })
    } catch {
      // Never let capture break the log call it is observing.
    }
    original.apply(console, args as Parameters<typeof console.error>)
  }

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
    console.error = original
  }
}
