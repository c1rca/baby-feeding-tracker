import type { BabySummary } from '../babies/babyApi'

const initials = (name: string) => name.trim().slice(0, 1).toUpperCase() || '·'

export function BabyAvatar({ baby, size = 28 }: { baby: Pick<BabySummary, 'name' | 'photo'> | undefined; size?: number }) {
  if (!baby) return null
  const style = { width: size, height: size }
  return baby.photo
    ? <img className="baby-avatar" style={style} src={baby.photo} alt="" aria-hidden="true" />
    : <span className="baby-avatar baby-avatar--initial" style={style} aria-hidden="true">{initials(baby.name)}</span>
}
