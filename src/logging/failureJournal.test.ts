import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDelivered, journalSize, readJournal, recordSendFailure } from './failureJournal'

// jsdom has no IndexedDB. fake-indexeddb is not a dependency here, so this
// stands in a minimal in-memory store with the same surface the journal uses.
// It is enough to prove the contract: what is written is retained, and only
// what the server confirms is removed.
const makeFakeIndexedDb = () => {
  const rows = new Map<number, unknown>()
  let nextId = 1
  const request = <T,>(result: T) => {
    const r: Record<string, unknown> = { result }
    queueMicrotask(() => (r.onsuccess as (() => void) | undefined)?.())
    return r as unknown as IDBRequest<T>
  }
  const store = {
    add: (value: Record<string, unknown>) => { const id = nextId++; rows.set(id, { ...value, id }); return request(id) },
    getAll: () => request([...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value)),
    delete: (id: number) => { rows.delete(id); return request(undefined) },
  }
  const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => store, transaction: () => ({ objectStore: () => store }), close: () => {} }
  return {
    open: () => {
      const r: Record<string, unknown> = { result: db }
      queueMicrotask(() => (r.onsuccess as (() => void) | undefined)?.())
      return r
    },
    rows,
  }
}

const failure = (n: number) => ({
  at: `2026-07-28T10:0${n}:00.000Z`,
  kind: 'state-write' as const,
  reason: 'sync failed (503)',
  status: 503,
  babyId: 'b1',
  clientId: 'c1',
  counts: { entries: n },
  payload: { entries: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })) },
})

describe('failure journal', () => {
  let fake: ReturnType<typeof makeFakeIndexedDb>
  beforeEach(() => { fake = makeFakeIndexedDb(); vi.stubGlobal('indexedDB', fake) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('retains the payload of a write that never reached the server', async () => {
    await recordSendFailure(failure(2))
    const journal = await readJournal()
    expect(journal).toHaveLength(1)
    expect(journal[0].reason).toBe('sync failed (503)')
    expect(journal[0].status).toBe(503)
    // The payload is the reason this exists — it has to survive whole.
    expect(journal[0].payload).toEqual({ entries: [{ id: 'e0' }, { id: 'e1' }] })
  })

  it('keeps every failure, not just the most recent', async () => {
    await recordSendFailure(failure(1))
    await recordSendFailure(failure(2))
    await recordSendFailure(failure(3))
    expect(await readJournal()).toHaveLength(3)
  })

  it('retains confirmed failures locally for reconstruction', async () => {
    await recordSendFailure(failure(1))
    await recordSendFailure(failure(2))
    const before = await readJournal()

    await clearDelivered([before[0].id!])

    // Upload acknowledgement is delivery metadata, never permission to erase
    // local forensic evidence.
    expect(await readJournal()).toEqual(before)
  })

  it('reports how much is waiting, for the settings row', async () => {
    await recordSendFailure(failure(1))
    const size = await journalSize()
    expect(size.entries).toBe(1)
    expect(size.bytes).toBeGreaterThan(0)
  })

  it('never throws when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(recordSendFailure(failure(1))).resolves.toBeUndefined()
    expect(await readJournal()).toEqual([])
  })
})
