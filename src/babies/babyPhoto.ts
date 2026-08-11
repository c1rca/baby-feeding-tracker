// Avatars are downscaled hard in the browser before they ever leave it. A phone
// photo is several megabytes; what this feature needs is a thumbnail, so it is
// re-encoded to a small square JPEG. That keeps it small enough to live on the
// baby row and sync across devices, instead of sitting in localStorage next to
// the offline copy of the health log where a quota failure would cost data.

export const AVATAR_PIXELS = 256
export const AVATAR_MAX_BYTES = 64 * 1024
const AVATAR_QUALITIES = [0.82, 0.7, 0.6, 0.5]

export type AvatarResult = { ok: true; dataUrl: string } | { ok: false; error: string }

// Rough byte length of what a data URL actually costs to store and send.
export const dataUrlBytes = (dataUrl: string) => {
  const comma = dataUrl.indexOf(',')
  const payload = comma === -1 ? dataUrl : dataUrl.slice(comma + 1)
  return Math.floor((payload.length * 3) / 4)
}

export const isSupportedImage = (type: string) => /^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(type)

export const isAvatarDataUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && dataUrlBytes(value) <= AVATAR_MAX_BYTES

// Centre-crop to a square so portrait and landscape photos both frame sensibly.
const squareCrop = (width: number, height: number) => {
  const side = Math.min(width, height)
  return { sx: (width - side) / 2, sy: (height - side) / 2, side }
}

export async function prepareAvatar(file: File): Promise<AvatarResult> {
  if (!isSupportedImage(file.type)) return { ok: false, error: 'Choose a PNG, JPEG, or WebP image.' }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, error: 'That image could not be read.' }
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_PIXELS
    canvas.height = AVATAR_PIXELS
    const context = canvas.getContext('2d')
    if (!context) return { ok: false, error: 'That image could not be processed.' }

    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height)
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_PIXELS, AVATAR_PIXELS)

    // Step the quality down until it fits rather than rejecting a big photo.
    for (const quality of AVATAR_QUALITIES) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrlBytes(dataUrl) <= AVATAR_MAX_BYTES) return { ok: true, dataUrl }
    }
    return { ok: false, error: 'That image is too detailed to shrink — try a different one.' }
  } finally {
    bitmap.close?.()
  }
}
