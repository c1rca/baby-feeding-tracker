import { authFetch } from '../auth/authSession'

export type BabySex = 'female' | 'male'

export type BabySummary = {
  id: string
  name: string
  dob?: string | null
  sex?: BabySex | null
  birthWeightLb?: number | null
  birthLengthCm?: number | null
  pediatricianName?: string | null
  pediatricianPhone?: string | null
  photo?: string | null
  archivedAt?: string | null
}

export type BabyProfilePatch = {
  name: string
  dob?: string
  sex?: BabySex | ''
  birthWeightLb?: number | null
  birthLengthCm?: number | null
  pediatricianName?: string
  pediatricianPhone?: string
  photo?: string
}

export type BabiesResult = { ok: true; babies: BabySummary[] } | { ok: false }

// A failure has to be distinguishable from an empty household: returning [] for
// both made an unreachable server look like "you have no babies".
export async function fetchBabiesResult(): Promise<BabiesResult> {
  try {
    const response = await authFetch('/api/babies', { cache: 'no-store' })
    if (!response.ok) return { ok: false }
    const data = await response.json() as { babies?: BabySummary[] }
    const babies = Array.isArray(data.babies) ? data.babies.filter((baby): baby is BabySummary => typeof baby?.id === 'string' && typeof baby?.name === 'string') : []
    return { ok: true, babies }
  } catch {
    return { ok: false }
  }
}

export async function fetchBabies(): Promise<BabySummary[]> {
  const result = await fetchBabiesResult()
  return result.ok ? result.babies : []
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

export async function updateBabyProfile(babyId: string, patch: BabyProfilePatch): Promise<BabySummary | null> {
  try {
    const response = await authFetch(`/api/babies/${encodeURIComponent(babyId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) return null
    const data = await response.json() as { baby?: BabySummary }
    return data.baby && typeof data.baby.id === 'string' ? data.baby : null
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
