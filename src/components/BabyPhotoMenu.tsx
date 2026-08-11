import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Settings2, Trash2 } from 'lucide-react'
import { prepareAvatar } from '../babies/babyPhoto'

export type BabyPhotoMenuProps = {
  babyId?: string
  babyName?: string
  babyPhoto?: string
  canEdit: boolean
  onUpdatePhoto?: (babyId: string, photo: string) => Promise<boolean>
  onOpenBabySettings?: () => void
  showToast?: (message: string) => void
}

/**
 * The baby's picture in the brief header, made the control for changing it.
 *
 * Buried in Settings › Baby is where it lived; the photo itself is the thing a
 * caregiver reaches for. The heavy lifting — downscale, re-encode, size check —
 * is the same `prepareAvatar` the settings form uses, so a photo added here is
 * byte-for-byte the one added there.
 */
export function BabyPhotoMenu({ babyId, babyName, babyPhoto, canEdit, onUpdatePhoto, onOpenBabySettings, showToast }: BabyPhotoMenuProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const label = babyName ? `${babyName}’s photo` : 'Baby photo'
  // Without a baby loaded or the right to edit it, the picture is just a
  // picture — no affordance is better than one that does nothing.
  const interactive = canEdit && Boolean(babyId) && Boolean(onUpdatePhoto)

  const save = async (photo: string) => {
    if (!babyId || !onUpdatePhoto) return
    setPending(true)
    const ok = await onUpdatePhoto(babyId, photo)
    setPending(false)
    setOpen(false)
    showToast?.(ok ? (photo ? 'Photo saved' : 'Photo removed') : 'Could not save the photo')
  }

  const choose = async (file: File | undefined) => {
    if (!file) return
    setPending(true)
    const result = await prepareAvatar(file)
    setPending(false)
    if (!result.ok) { setOpen(false); return showToast?.(result.error) }
    await save(result.dataUrl)
  }

  const picture = babyPhoto
    ? <img className="today-brief-photo" src={babyPhoto} alt={label} />
    : <span className="today-brief-photo is-empty" aria-hidden="true">{babyName ? babyName.trim().charAt(0).toUpperCase() : <Camera size={18} />}</span>

  if (!interactive) return babyPhoto ? picture : babyName ? <span className="today-brief-baby">{babyName}</span> : null

  return (
    <div className="baby-photo-menu" ref={wrapRef}>
      <button
        type="button"
        className={`baby-photo-trigger${pending ? ' is-pending' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={babyPhoto ? `Change ${label}` : `Add ${label}`}
        title={babyPhoto ? 'Change photo' : 'Add photo'}
        onClick={() => setOpen((current) => !current)}
      >
        {picture}
        <span className="baby-photo-hint" aria-hidden="true"><Camera size={13} /></span>
      </button>

      <input
        ref={fileRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Baby photo file"
        onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = '' }}
      />

      {open ? (
        <div className="baby-photo-sheet" role="menu" aria-label={`${label} options`}>
          <button type="button" role="menuitem" disabled={pending} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={15} /> {babyPhoto ? 'Change photo' : 'Add photo'}
          </button>
          {babyPhoto ? (
            <button type="button" role="menuitem" className="danger-menu" disabled={pending} onClick={() => void save('')}>
              <Trash2 size={15} /> Remove photo
            </button>
          ) : null}
          {onOpenBabySettings ? (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenBabySettings() }}>
              <Settings2 size={15} /> Baby settings
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
