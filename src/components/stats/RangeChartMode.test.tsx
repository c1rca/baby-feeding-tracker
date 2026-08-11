import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FeedingHoursCard, RhythmCard } from './StatsDashboardSections'
import type { calculateStats, calculateTrend } from '../../domain/trackerDomain'

const day = (index: number, value: number) => ({
  label: `D${index}`,
  startMs: new Date(2026, 6, 20 + index).getTime(),
  endMs: new Date(2026, 6, 21 + index).getTime(),
  seconds: value * 3600,
  hours: value,
  count: value,
})

const stats = { feedingHoursByDay: [0, 1, 2, 3, 4, 5, 6].map((i) => day(i, i)), totalNursing: 3600, avgFeedingHoursPerDay: 1.5, rangeDays: 7 } as unknown as ReturnType<typeof calculateStats>
const trend = { days: [0, 1, 2, 3, 4, 5, 6].map((i) => day(i, i + 1)) } as unknown as ReturnType<typeof calculateTrend>

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const card = (name: RegExp) => screen.getByRole('region', { name })

describe('line / bars toggle on the range charts', () => {
  it('starts as a line chart and switches to bars', async () => {
    const user = userEvent.setup()
    render(<FeedingHoursCard stats={stats} />)
    const region = card(/Daily feeding hours/i)

    expect(region.querySelector('.range-trend-chart.is-line')).toBeTruthy()
    expect(region.querySelector('.range-line')).toBeTruthy()
    expect(region.querySelectorAll('.range-bar')).toHaveLength(0)

    await user.click(within(region).getByRole('button', { name: /as a bar chart/i }))

    expect(region.querySelector('.range-trend-chart.is-bar')).toBeTruthy()
    expect(region.querySelectorAll('.range-bar')).toHaveLength(7)
    // The line and its points are gone, not merely hidden underneath.
    expect(region.querySelector('.range-line')).toBeNull()
    expect(region.querySelectorAll('.range-point')).toHaveLength(0)
  })

  it('keeps the readout, axis, gridlines and hover bands in both modes', async () => {
    const user = userEvent.setup()
    render(<FeedingHoursCard stats={stats} />)
    const region = card(/Daily feeding hours/i)
    const chrome = () => ({
      readout: Boolean(region.querySelector('.range-selected-value')),
      yAxis: Boolean(region.querySelector('.range-y-axis')),
      gridlines: region.querySelectorAll('.range-grid-line').length,
      bands: region.querySelectorAll('.range-point-control').length,
      axis: Boolean(region.querySelector('.range-axis')),
    })
    const asLine = chrome()
    await user.click(within(region).getByRole('button', { name: /as a bar chart/i }))
    expect(chrome()).toEqual(asLine)
  })

  it('remembers the choice per chart', async () => {
    const user = userEvent.setup()
    render(<><FeedingHoursCard stats={stats} /><RhythmCard trend={trend} /></>)
    await user.click(within(card(/Daily feeding hours/i)).getByRole('button', { name: /as a bar chart/i }))

    cleanup()
    render(<><FeedingHoursCard stats={stats} /><RhythmCard trend={trend} /></>)
    // The one switched stays on bars; the other is untouched.
    expect(card(/Daily feeding hours/i).querySelector('.range-trend-chart.is-bar')).toBeTruthy()
    expect(card(/Feeding rhythm/i).querySelector('.range-trend-chart.is-line')).toBeTruthy()
  })

  it('still selects a day by hovering in bar mode', async () => {
    const user = userEvent.setup()
    render(<FeedingHoursCard stats={stats} />)
    const region = card(/Daily feeding hours/i)
    await user.click(within(region).getByRole('button', { name: /as a bar chart/i }))

    const bands = within(region).getAllByRole('button', { name: /^\w+ \d+: / })
    expect(bands).toHaveLength(7)
    await user.hover(bands[2])
    expect(bands[2].getAttribute('aria-pressed')).toBe('true')
    expect(region.querySelectorAll('.range-bar.is-selected')).toHaveLength(1)
  })

  it('names the toggle for each chart so two on a page are distinguishable', () => {
    render(<><FeedingHoursCard stats={stats} /><RhythmCard trend={trend} /></>)
    expect(screen.getByRole('group', { name: /Daily nursing time chart style/i })).toBeTruthy()
    expect(screen.getByRole('group', { name: /Feeds by day chart style/i })).toBeTruthy()
  })
})
