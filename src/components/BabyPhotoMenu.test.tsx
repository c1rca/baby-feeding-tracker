import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BabyPhotoMenu } from './BabyPhotoMenu'

const PHOTO = 'data:image/jpeg;base64,abc'

const setup = (over: Partial<Parameters<typeof BabyPhotoMenu>[0]> = {}) => {
  const onUpdatePhoto = vi.fn().mockResolvedValue(true)
  const showToast = vi.fn()
  render(<BabyPhotoMenu babyId="b1" babyName="Robin" canEdit onUpdatePhoto={onUpdatePhoto} showToast={showToast} {...over} />)
  return { onUpdatePhoto, showToast }
}

describe('changing the baby photo from the brief', () => {
  afterEach(cleanup)

  it('turns the picture into the control, and names what it does', async () => {
    const user = userEvent.setup()
    setup({ babyPhoto: PHOTO })

    const trigger = screen.getByRole('button', { name: /Change Robin’s photo/i })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const menu = screen.getByRole('menu', { name: /Robin’s photo options/i })
    expect(within(menu).getByRole('menuitem', { name: /Change photo/i })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: /Remove photo/i })).toBeTruthy()
  })

  it('offers adding rather than changing when there is no photo yet', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: /Add Robin’s photo/i }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Add photo/i })).toBeTruthy()
    // Nothing to remove.
    expect(within(menu).queryByRole('menuitem', { name: /Remove photo/i })).toBeNull()
  })

  it('removes the photo and says so', async () => {
    const user = userEvent.setup()
    const { onUpdatePhoto, showToast } = setup({ babyPhoto: PHOTO })

    await user.click(screen.getByRole('button', { name: /Change Robin’s photo/i }))
    await user.click(screen.getByRole('menuitem', { name: /Remove photo/i }))

    expect(onUpdatePhoto).toHaveBeenCalledWith('b1', '')
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Photo removed'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('reports a failed save rather than pretending it worked', async () => {
    const user = userEvent.setup()
    const { showToast } = setup({ babyPhoto: PHOTO, onUpdatePhoto: vi.fn().mockResolvedValue(false) })

    await user.click(screen.getByRole('button', { name: /Change Robin’s photo/i }))
    await user.click(screen.getByRole('menuitem', { name: /Remove photo/i }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Could not save the photo'))
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    setup({ babyPhoto: PHOTO })

    await user.click(screen.getByRole('button', { name: /Change Robin’s photo/i }))
    expect(screen.getByRole('menu')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  // A caregiver who cannot edit the baby should not be offered a control that
  // would fail — the picture stays a picture.
  it('is not interactive without edit rights', () => {
    render(<BabyPhotoMenu babyId="b1" babyName="Robin" babyPhoto={PHOTO} canEdit={false} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByAltText(/Robin’s photo/i)).toBeTruthy()
  })

  it('falls back to the name chip when there is no photo and no rights', () => {
    render(<BabyPhotoMenu babyName="Robin" canEdit={false} />)
    expect(screen.getByText('Robin')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
