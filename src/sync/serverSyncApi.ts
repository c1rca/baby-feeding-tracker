import { authFetch } from '../auth/authSession'
import type { ServerState } from '../types'
import { CLIENT_ID } from './clientId'
import { API_STATE } from './serverSyncTypes'

type ServerStateScope = {
  babyId?: string | null
}

const babyScopeHeaders = (scope?: ServerStateScope) => {
  const babyId = String(scope?.babyId || '').trim()
  return babyId ? { 'X-Baby-Id': babyId } : undefined
}

export async function loadServerState(scope?: ServerStateScope) {
  const headers = babyScopeHeaders(scope)
  const response = await authFetch(API_STATE, headers ? { cache: 'no-store', headers } : { cache: 'no-store' })
  if (!response.ok) throw new Error('load failed')
  return await response.json() as ServerState
}

export async function saveServerState(body: unknown, scope?: ServerStateScope) {
  // X-Client-Id lets the live stream tag this write's broadcast as ours so
  // this tab ignores its own echo (other tabs/devices still receive it).
  const headers = { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID, ...babyScopeHeaders(scope) }
  const response = await authFetch(API_STATE, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('sync failed')
  return await response.json() as { updatedAt?: string; staleWriteMerged?: boolean; state?: ServerState }
}
