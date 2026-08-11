import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AVATAR_MAX_BYTES, dataUrlBytes, isAvatarDataUrl, isSupportedImage } from './babyPhoto'
import { BabyAvatar } from '../components/BabyAvatar'

const jpegOf = (chars: number) => `data:image/jpeg;base64,${'A'.repeat(chars)}`

describe('avatar validation', () => {
  it('measures the stored cost of a data URL, not its string length', () => {
    expect(dataUrlBytes(jpegOf(400))).toBe(300)
    expect(dataUrlBytes('no-comma')).toBeGreaterThan(0)
  })

  it('accepts small raster images and rejects anything else', () => {
    expect(isAvatarDataUrl(jpegOf(400))).toBe(true)
    expect(isAvatarDataUrl(`data:image/png;base64,${'A'.repeat(80)}`)).toBe(true)
    expect(isAvatarDataUrl('https://example.com/pic.jpg')).toBe(false)
    expect(isAvatarDataUrl('data:text/html;base64,AAAA')).toBe(false)
    expect(isAvatarDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isAvatarDataUrl(null)).toBe(false)
  })

  it('refuses anything over the size ceiling', () => {
    const tooBig = jpegOf(Math.ceil((AVATAR_MAX_BYTES + 1024) * 4 / 3))
    expect(dataUrlBytes(tooBig)).toBeGreaterThan(AVATAR_MAX_BYTES)
    expect(isAvatarDataUrl(tooBig)).toBe(false)
  })

  it('recognises the image types a phone camera roll produces', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic']) {
      expect(isSupportedImage(type)).toBe(true)
    }
    expect(isSupportedImage('image/svg+xml')).toBe(false)
    expect(isSupportedImage('application/pdf')).toBe(false)
  })
})

describe('BabyAvatar', () => {
  afterEach(cleanup)

  it('renders the photo when there is one, decoratively — the name is already text', () => {
    const { container } = render(<BabyAvatar baby={{ name: 'Robin', photo: jpegOf(400) }} />)
    const image = container.querySelector('img')!
    expect(image.getAttribute('src')).toContain('data:image/jpeg')
    expect(image.getAttribute('alt')).toBe('')
  })

  it('falls back to an initial rather than a broken image', () => {
    render(<BabyAvatar baby={{ name: 'robin', photo: null }} />)
    expect(screen.getByText('R')).toBeTruthy()
  })

  it('renders nothing without a baby', () => {
    const { container } = render(<BabyAvatar baby={undefined} />)
    expect(container.firstChild).toBeNull()
  })
})
