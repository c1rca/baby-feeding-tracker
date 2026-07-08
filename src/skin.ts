import lullabyCss from './styles.css?inline'
import classicCss from './styles-classic.css?inline'

export type Skin = 'lullaby' | 'classic'

const SKIN_STORAGE_KEY = 'baby-feeding-tracker:v1:skin'
const STYLE_ELEMENT_ID = 'app-skin-styles'

export const skinLabel: Record<Skin, string> = {
  lullaby: 'Lullaby (new)',
  classic: 'Classic',
}

export const readSkin = (): Skin => {
  try {
    return localStorage.getItem(SKIN_STORAGE_KEY) === 'classic' ? 'classic' : 'lullaby'
  } catch {
    return 'lullaby'
  }
}

export const applySkin = (skin: Skin) => {
  let styleElement = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = STYLE_ELEMENT_ID
    document.head.appendChild(styleElement)
  }
  styleElement.textContent = skin === 'classic' ? classicCss : lullabyCss
  document.documentElement.setAttribute('data-skin', skin)
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skin)
  } catch {
    // The design still applies for this visit even if persistence fails.
  }
}
