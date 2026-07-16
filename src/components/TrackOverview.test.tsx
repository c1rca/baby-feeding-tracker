import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrackOverview } from './TrackOverview'

describe('TrackOverview main page', () => {
  it('keeps the main dashboard focused on today and omits the 7-day trend', () => {
    render(<TrackOverview
      today={{ count: 3, nursing: 0, oz: 0, left: 0, right: 0, wet: 0, stool: 0 }}
      pumpedOzToday={0}
      pumpCountToday={0}
      showBottleStat={false}
      showPumpStat={false}
      rhythm={{ dayStartMs: 0, dayEndMs: 86_400_000, nowMs: 43_200_000, feeds: [], diapers: [], spans: [], summary: '0 feeds, 0 diapers' }}
    />)

    expect(screen.queryByRole('heading', { name: '7-Day Trend' })).toBeNull()
    expect(screen.queryByRole('group', { name: /7-day feeding trend/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Diapers today/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Feeds today/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /^Nursing$/i })).toBeNull()
    expect(screen.getByRole('img', { name: /today's rhythm/i })).toBeTruthy()
  })
})
