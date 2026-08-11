// Remembers what was in the last bottle so the quick-log sheet opens on the
// household's usual choice instead of asking every time.
import { isBottleContent } from '../domain/labels'
import type { BottleContent } from '../types'

const KEY = 'baby-feeding-tracker:v1:last-bottle-content'
const DEFAULT_BOTTLE_CONTENT: BottleContent = 'breastmilk'

export const readLastBottleContent = (): BottleContent => {
  try {
    const stored = localStorage.getItem(KEY)
    return isBottleContent(stored) ? stored : DEFAULT_BOTTLE_CONTENT
  } catch {
    return DEFAULT_BOTTLE_CONTENT
  }
}

export const persistLastBottleContent = (content: BottleContent) => {
  try {
    localStorage.setItem(KEY, content)
  } catch {
    // Best-effort; the in-memory choice still applies to this log.
  }
}
