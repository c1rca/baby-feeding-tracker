import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadServerState, saveServerState } from './serverSyncApi'

const fetchMock = vi.fn()

vi.mock('../auth/authSession', () => ({
  authFetch: (...args: unknown[]) => fetchMock(...args),
}))

afterEach(() => {
  fetchMock.mockReset()
})

describe('serverSyncApi', () => {
  it('sends selected baby scope header when loading server state', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, entries: [] }), { status: 200 }))

    await loadServerState({ babyId: ' baby-2 ' })

    expect(fetchMock).toHaveBeenCalledWith('/api/state', {
      cache: 'no-store',
      headers: { 'X-Baby-Id': 'baby-2' },
    })
  })

  it('sends selected baby scope header when saving server state', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updatedAt: 'server-new' }), { status: 200 }))

    await saveServerState({ entries: [] }, { babyId: 'baby-2' })

    expect(fetchMock).toHaveBeenCalledWith('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Baby-Id': 'baby-2' },
      body: JSON.stringify({ entries: [] }),
    })
  })

  it('omits baby scope header when no selected baby exists', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, entries: [] }), { status: 200 }))

    await loadServerState()

    expect(fetchMock).toHaveBeenCalledWith('/api/state', { cache: 'no-store' })
  })
})
