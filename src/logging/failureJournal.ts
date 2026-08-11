/**
 * A local record of every write that failed to reach the server.
 *
 * The backup log runs server-side, which means a write that never arrives is
 * invisible to it — precisely the case where something could go missing. This
 * journal closes that gap from the other end: whatever the client tried to send
 * is kept on the device until it can be handed over.
 *
 * IndexedDB rather than localStorage, because a full-state snapshot runs to
 * hundreds of kilobytes and a handful would exhaust the 5MB localStorage quota.
 * IndexedDB gives us room to keep a real history, and it survives a reload, a
 * crash and a closed tab.
 */

const DB_NAME = 'baby-feeding-tracker-debug'
const DB_VERSION = 1
const STORE = 'send-failures'

export type SendFailure = {
  id?: number
  at: string
  kind: 'state-write' | 'state-snapshot'
  reason: string
  status: number | null
  babyId: string | null
  clientId: string
  counts: Record<string, number>
  payload: unknown
}

const hasIndexedDb = () => typeof indexedDB !== 'undefined'

const openDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (!hasIndexedDb()) {
      resolve(null)
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    request.onsuccess = () => resolve(request.result)
    // A blocked or unavailable database must never break a care write; the
    // journal is a safety net, not a dependency.
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

const withStore = async <T,>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> => {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    let request: IDBRequest<T>
    try {
      request = run(db.transaction(STORE, mode).objectStore(STORE))
    } catch {
      db.close()
      resolve(null)
      return
    }
    request.onsuccess = () => { resolve(request.result); db.close() }
    request.onerror = () => { resolve(null); db.close() }
  })
}

/** Record a write that did not reach the server. Never throws. */
export async function recordSendFailure(failure: Omit<SendFailure, 'id'>): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.add(failure) as IDBRequest<IDBValidKey>)
  } catch {
    // Losing the journal entry is bad; breaking the app over it is worse.
  }
}

/** Everything still held on this device, oldest first. */
export async function readJournal(): Promise<SendFailure[]> {
  const all = await withStore<SendFailure[]>('readonly', (store) => store.getAll() as IDBRequest<SendFailure[]>)
  return all ?? []
}

export async function journalSize(): Promise<{ entries: number; bytes: number }> {
  const all = await readJournal()
  return { entries: all.length, bytes: all.reduce((total, entry) => total + JSON.stringify(entry).length, 0) }
}

/** Upload acknowledgement never deletes local forensic evidence. */
export async function clearDelivered(_ids: number[]): Promise<void> {
  // Intentionally retained: client logs are the recovery source of truth.
}
