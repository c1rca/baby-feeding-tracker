export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export type SideSegment = { side: 'left' | 'right'; startedAt: number; endedAt: number }

export const sumSideDurations = (segments: SideSegment[]) =>
  segments.reduce(
    (acc, seg) => {
      const sec = Math.max(0, Math.round((seg.endedAt - seg.startedAt) / 1000))
      if (seg.side === 'left') acc.left += sec
      else acc.right += sec
      return acc
    },
    { left: 0, right: 0 },
  )
