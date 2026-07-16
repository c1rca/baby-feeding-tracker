import { authFetch } from '../auth/authSession'

export type BabySummary = {
  id: string
  name: string
  dob?: string | null
  archivedAt?: string | null
}

export async function fetchBabies(): Promise<BabySummary[]> {
  try {
    const response = await authFetch('/api/babies', { cache: 'no-store' })
    if (!response.ok) return []
    const data = await response.json() as { babies?: BabySummary[] }
    return Array.isArray(data.babies) ? data.babies.filter((baby): baby is BabySummary => typeof baby?.id === 'string' && typeof baby?.name === 'string') : []
  } catch {
    return []
  }
}

export async function createBaby(input: { name: string; dob?: string }): Promise<BabySummary | null> {
  try {
    const response = await authFetch('/api/babies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.name, dob: input.dob || undefined }),
    })
    if (!response.ok) return null
    const data = await response.json() as { baby?: BabySummary }
    return data.baby && typeof data.baby.id === 'string' && typeof data.baby.name === 'string' ? data.baby : null
  } catch {
    return null
  }
}

export async function renameBaby(babyId: string, name: string): Promise<BabySummary | null> {
  try {
    const response = await authFetch(`/api/babies/${encodeURIComponent(babyId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) return null
    const data = await response.json() as { baby?: BabySummary }
    return data.baby && typeof data.baby.id === 'string' && typeof data.baby.name === 'string' ? data.baby : null
  } catch {
    return null
  }
}

export async function archiveBaby(babyId: string): Promise<boolean> {
  try {
    const response = await authFetch(`/api/babies/${encodeURIComponent(babyId)}`, { method: 'DELETE' })
    return response.ok
  } catch {
    return false
  }
}
