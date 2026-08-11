import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// The endpoint is read at module load, so it must be stubbed before the import.
vi.stubEnv('VITE_ACTION_LOG_URL', 'http://localhost:8099')

const loadModule = async () => {
  vi.resetModules()
  return await import('./actionLog')
}

describe('action backup log', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the full state for an action', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { recordAction } = await loadModule()

    recordAction({ action: 'entries.added', babyId: 'b1', state: { entries: [{ id: 'e1' }] } })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const call = fetchMock.mock.calls[0]!
    expect(call[0]).toBe('http://localhost:8099/log')
    const body = JSON.parse(String(call[1]!.body))
    expect(body.actions[0].action).toBe('entries.added')
    expect(body.actions[0].state).toEqual({ entries: [{ id: 'e1' }] })
    expect(body.actions[0].clientId).toBeTruthy()
    expect(body.actions[0].at).toBeTruthy()
  })

  it('keeps the action when the server is unreachable so it can still be recovered', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, _init?: RequestInit) => { throw new Error('offline') }))
    const { recordAction } = await loadModule()

    recordAction({ action: 'entries.added', babyId: 'b1', state: { entries: [{ id: 'e1' }] } })

    await vi.waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('tracker.actionLog.outbox.v1') || '[]')
      expect(stored).toHaveLength(1)
      expect(stored[0].action).toBe('entries.added')
    })
  })

  it('drains a backlog left by an earlier failure once the server returns', async () => {
    window.localStorage.setItem(
      'tracker.actionLog.outbox.v1',
      JSON.stringify([{ action: 'entries.added', at: 'earlier', clientId: 'c1', state: { entries: [] } }]),
    )
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { flushActionLog } = await loadModule()

    await flushActionLog()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))
    expect(body.actions[0].at).toBe('earlier')
    expect(JSON.parse(window.localStorage.getItem('tracker.actionLog.outbox.v1') || '[]')).toHaveLength(0)
  })

  it('does not drop actions queued while a flush is in flight', async () => {
    let release: (value: Response) => void = () => {}
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>((resolve) => { release = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    const { recordAction, flushActionLog } = await loadModule()

    recordAction({ action: 'first', babyId: 'b1', state: { entries: [] } })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    recordAction({ action: 'second', babyId: 'b1', state: { entries: [{ id: 'e2' }] } })
    release(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await flushActionLog()

    const stored = JSON.parse(window.localStorage.getItem('tracker.actionLog.outbox.v1') || '[]')
    expect(stored.map((r: { action: string }) => r.action)).not.toContain('first')
    const sent = fetchMock.mock.calls.flatMap((call) => JSON.parse(String(call[1]!.body)).actions.map((a: { action: string }) => a.action))
    expect(sent).toContain('second')
  })

  it('does not mark a large snapshot keepalive, which browsers refuse over 64KB', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { recordAction } = await loadModule()

    // A real household's full state was ~441KB; anything over the 64KB
    // keepalive budget must go as an ordinary request or the post hangs.
    const big = { entries: Array.from({ length: 4000 }, (_, i) => ({ id: String(i), note: 'x'.repeat(100) })) }
    recordAction({ action: 'entries.added', babyId: 'b1', state: big })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const init = fetchMock.mock.calls[0]![1]!
    expect(String(init.body).length).toBeGreaterThan(64 * 1024)
    expect(init.keepalive).toBe(false)
  })

  it('still uses keepalive for a small payload', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { recordAction } = await loadModule()

    recordAction({ action: 'theme.changed', babyId: 'b1', state: { theme: 'dark' } })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0]![1]!.keepalive).toBe(true)
  })
})
