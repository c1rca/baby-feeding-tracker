import { authFetch } from '../auth/authSession'

export type HouseholdMember = { userId: string; email?: string; displayName?: string; role: 'owner' | 'caregiver' | 'viewer'; createdAt?: string }
export type HouseholdInvite = { id: string; email: string; role: 'caregiver' | 'viewer'; token?: string; expiresAt?: string }

const readJson = async <T>(response: Response): Promise<T | null> => response.json().catch(() => null) as Promise<T | null>

export async function fetchHouseholdAccess() {
  const [membersResponse, invitesResponse] = await Promise.all([
    authFetch('/api/household-members'),
    authFetch('/api/household-invites'),
  ])
  const membersData = await readJson<{ members?: HouseholdMember[]; error?: string }>(membersResponse)
  const invitesData = await readJson<{ invites?: HouseholdInvite[]; error?: string }>(invitesResponse)
  if (!membersResponse.ok) return { ok: false as const, error: membersData?.error || 'Could not load household members' }
  if (!invitesResponse.ok) return { ok: false as const, error: invitesData?.error || 'Could not load household invites' }
  return { ok: true as const, members: membersData?.members || [], invites: invitesData?.invites || [] }
}

export async function createHouseholdInvite(email: string, role: 'caregiver' | 'viewer') {
  const response = await authFetch('/api/household-invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  })
  const data = await readJson<{ invite?: HouseholdInvite; error?: string }>(response)
  if (!response.ok || !data?.invite) return { ok: false as const, error: data?.error || 'Could not create invite' }
  return { ok: true as const, invite: data.invite }
}

export async function revokeHouseholdInvite(inviteId: string) {
  const response = await authFetch(`/api/household-invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' })
  const data = await readJson<{ error?: string }>(response)
  if (!response.ok) return { ok: false as const, error: data?.error || 'Could not revoke invite' }
  return { ok: true as const }
}

export async function updateHouseholdMemberRole(userId: string, role: 'caregiver' | 'viewer') {
  const response = await authFetch(`/api/household-members/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  const data = await readJson<{ error?: string }>(response)
  if (!response.ok) return { ok: false as const, error: data?.error || 'Could not update member' }
  return { ok: true as const }
}
