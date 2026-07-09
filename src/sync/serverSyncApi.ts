import { authFetch } from '../auth/authSession'
import type { ServerState } from '../types'
import { API_STATE } from './serverSyncTypes'

export async function loadServerState() {
  const response = await authFetch(API_STATE, { cache: 'no-store' })
  if (!response.ok) throw new Error('load failed')
  return await response.json() as ServerState
}

export async function saveServerState(body: unknown) {
  const response = await authFetch(API_STATE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('sync failed')
  return await response.json() as { updatedAt?: string; staleWriteMerged?: boolean; state?: ServerState }
}
