import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { CustomTrackersSetting } from './CustomTrackersTab'
import { CUSTOM_TRACKER_LIMIT, type CustomTracker } from '../../../types'

/**
 * Renders the setting against real state, because every bug worth catching here
 * is in the round trip: what the form writes must be what the list reads back,
 * and what the list reads back is what syncs to the other caregiver's phone.
 */
function Harness({ initial = [] as CustomTracker[] }) {
  const [customTrackers, setCustomTrackers] = useState<CustomTracker[]>(initial)
  const [toast, setToast] = useState('')
  return (
    <div>
      <CustomTrackersSetting customTrackers={customTrackers} setCustomTrackers={setCustomTrackers} showToast={setToast} />
      <span data-testid="toast">{toast}</span>
      <span data-testid="state">{JSON.stringify(customTrackers)}</span>
    </div>
  )
}

const state = (): CustomTracker[] => JSON.parse(screen.getByTestId('state').textContent || '[]')
const section = () => screen.getByLabelText('Custom trackers')
const click = (name: string | RegExp) => act(() => { screen.getByRole('button', { name }).click() })

const fillName = (value: string) => fireEvent.change(screen.getByLabelText('Tracker name'), { target: { value } })

const tracker = (over: Partial<CustomTracker> = {}): CustomTracker => ({
  id: 't1', name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'count', target: 3 }, createdAt: 1000, archivedAt: null, ...over,
})

describe('managing custom trackers in Settings', () => {
  afterEach(cleanup)

  it('creates a tracker with the chosen name, icon, colour and goal', () => {
    render(<Harness />)
    expect(within(section()).getByText('Nothing custom yet')).toBeTruthy()

    click('Add custom tracker')
    fillName('Vitamin C')
    act(() => { screen.getByRole('radio', { name: 'Colour vitamin' }).click() })
    act(() => { screen.getByRole('radio', { name: 'Icon pill' }).click() })
    click(/^Times$/)
    fireEvent.change(screen.getByLabelText('Times per day'), { target: { value: '3' } })
    click('Add tracker')

    expect(state()).toHaveLength(1)
    expect(state()[0]).toMatchObject({ name: 'Vitamin C', icon: 'pill', hue: 'vitamin', goal: { kind: 'count', target: 3 } })
    // Every definition needs a stable id and a creation time — the sync layer
    // merges by id, and an id-less record is dropped on arrival.
    expect(state()[0].id).toBeTruthy()
    expect(state()[0].createdAt).toBeGreaterThan(0)
    expect(within(section()).getByText('Vitamin C')).toBeTruthy()
    expect(within(section()).getByText('3 times a day')).toBeTruthy()
  })

  it('refuses a nameless tracker instead of creating an unlabelled row', () => {
    render(<Harness />)
    click('Add custom tracker')
    fillName('   ')
    click('Add tracker')
    expect(state()).toHaveLength(0)
    expect(screen.getByTestId('toast').textContent).toMatch(/name/i)
  })

  it('marks a minutes goal as timed, so the row can offer a timer', () => {
    render(<Harness />)
    click('Add custom tracker')
    fillName('Physio')
    click(/^Minutes$/)
    fireEvent.change(screen.getByLabelText('Minutes per day'), { target: { value: '15' } })
    click('Add tracker')

    expect(state()[0]).toMatchObject({ goal: { kind: 'duration', targetMinutes: 15 }, timer: true })
  })

  it('edits in place, keeping the id so logged history stays attached', () => {
    render(<Harness initial={[tracker()]} />)
    click('Edit Vitamin C')

    expect((screen.getByLabelText('Tracker name') as HTMLInputElement).value).toBe('Vitamin C')
    fillName('Vitamin D')
    click(/^Once$/)
    click('Save changes')

    expect(state()).toHaveLength(1)
    expect(state()[0]).toMatchObject({ id: 't1', name: 'Vitamin D', goal: { kind: 'once' } })
    expect(within(section()).getByText('Once a day')).toBeTruthy()
  })

  it('archives rather than deletes, and can restore', () => {
    render(<Harness initial={[tracker()]} />)
    click('Archive Vitamin C')

    // The definition survives — deleting it would orphan every event logged
    // against it and silently rewrite the timeline.
    expect(state()).toHaveLength(1)
    expect(state()[0].archivedAt).toBeGreaterThan(0)
    expect(within(section()).getByText('Nothing custom yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Restore Vitamin C' })).toBeTruthy()

    click('Restore Vitamin C')
    expect(state()[0].archivedAt).toBeNull()
    expect(within(section()).queryByText('Nothing custom yet')).toBeNull()
  })

  it('stops at the cap, and counts only unarchived trackers toward it', () => {
    const full = Array.from({ length: CUSTOM_TRACKER_LIMIT }, (_, index) => tracker({ id: `t${index}`, name: `Tracker ${index}` }))
    render(<Harness initial={full} />)

    const add = screen.getByRole('button', { name: 'Add custom tracker' })
    expect((add as HTMLButtonElement).disabled).toBe(true)
    expect(within(section()).getByText(new RegExp(`used all ${CUSTOM_TRACKER_LIMIT}`, 'i'))).toBeTruthy()

    click('Archive Tracker 0')
    expect((screen.getByRole('button', { name: 'Add custom tracker' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('will not restore past the cap', () => {
    const trackers = [
      ...Array.from({ length: CUSTOM_TRACKER_LIMIT }, (_, index) => tracker({ id: `t${index}`, name: `Tracker ${index}` })),
      tracker({ id: 'old', name: 'Retired', archivedAt: 500 }),
    ]
    render(<Harness initial={trackers} />)

    // The archived list is a disclosure; open it before reaching the row.
    click(/^Archived/)
    click('Restore Retired')
    expect(state().find((item) => item.id === 'old')?.archivedAt).toBe(500)
    expect(screen.getByTestId('toast').textContent).toMatch(new RegExp(`${CUSTOM_TRACKER_LIMIT}`))
  })
})

// The form sits in a short scrolling panel on a phone. Anything that changes
// its height mid-use shifts every control below the change, so the next tap
// lands on the wrong one. These pin the two places that used to do that.
describe('the form does not move under you', () => {
  afterEach(cleanup)

  it('keeps a goal row present for every goal type, so switching cannot resize it', () => {
    render(<Harness />)
    click('Add custom tracker')
    const stack = () => screen.getByLabelText('Goal type').closest('.tracker-control-stack') as HTMLElement
    expect(stack()).toBeTruthy()
    click(/^Times$/)
    expect(within(stack()).getByLabelText('Times per day')).toBeTruthy()
    click(/^Once$/)
    // Once has no satellite input; the container is still there to hold the space.
    expect(stack()).toBeTruthy()
  })
})
