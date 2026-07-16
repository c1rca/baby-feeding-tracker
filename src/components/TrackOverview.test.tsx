import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrackOverview } from './TrackOverview'

describe('TrackOverview trend', () => {
  it('groups each day’s value, bar, and label into a compact accessible chart', () => {
    render(<TrackOverview
      today={{ count: 3, nursing: 0, oz: 0, left: 0, right: 0, wet: 0, stool: 0 }}
      trend={{ max: 20, days: [{ label: 'Sun', count: 19 }, { label: 'Mon', count: 13 }, { label: 'Tue', count: 14 }, { label: 'Wed', count: 14 }, { label: 'Thu', count: 14 }, { label: 'Fri', count: 13 }, { label: 'Sat', count: 9 }] }}
      pumpedOzToday={0}
      pumpCountToday={0}
      showBottleStat={false}
      showPumpStat={false}
      rhythm={{ dayStartMs: 0, dayEndMs: 86_400_000, nowMs: 43_200_000, feeds: [], diapers: [], spans: [], summary: '0 feeds, 0 diapers' }}
    />)

    const chart = screen.getByRole('group', { name: /7-day feeding trend/i })
    expect(within(chart).getByLabelText('Sun: 19 feeds')).toBeTruthy()
    expect(within(chart).getByLabelText('Sat: 9 feeds')).toBeTruthy()
  })
})
