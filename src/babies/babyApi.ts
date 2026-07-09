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
