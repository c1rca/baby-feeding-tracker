import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { DiaperKind, EditingDiaperState, Session } from '../types'

type AppUiEffectsOptions = {
  setNow: Dispatch<SetStateAction<number>>
  resumeFocusTick: number
  session: Session | null
  heroRef: RefObject<HTMLElement | null>
  setBottleOpen: Dispatch<SetStateAction<boolean>>
  setManualOpen: Dispatch<SetStateAction<boolean>>
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  setSelectedDiapers: Dispatch<SetStateAction<DiaperKind[]>>
  setEditingDiaper: Dispatch<SetStateAction<EditingDiaperState>>
  openEntryMenuId: string | null
  setOpenEntryMenuId: Dispatch<SetStateAction<string | null>>
  setConfirmingDeleteEntryId: Dispatch<SetStateAction<string | null>>
}

export function useAppUiEffects({
  setNow,
  resumeFocusTick,
  session,
  heroRef,
  setBottleOpen,
  setManualOpen,
  setSettingsOpen,
  setSelectedDiapers,
  setEditingDiaper,
  openEntryMenuId,
  setOpenEntryMenuId,
  setConfirmingDeleteEntryId,
}: AppUiEffectsOptions) {
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().getTime()), 1000)
    return () => window.clearInterval(timer)
  }, [setNow])

  useEffect(() => {
    if (!resumeFocusTick || !session) return
    window.requestAnimationFrame(() => {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const primaryControl = heroRef.current?.querySelector<HTMLButtonElement>('.hero-actions button')
      primaryControl?.focus({ preventScroll: true })
    })
  }, [heroRef, resumeFocusTick, session])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setBottleOpen(false)
      setManualOpen(false)
      setSettingsOpen(false)
      setSelectedDiapers([])
      setEditingDiaper(null)
      setOpenEntryMenuId(null)
      setConfirmingDeleteEntryId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setBottleOpen, setConfirmingDeleteEntryId, setEditingDiaper, setManualOpen, setOpenEntryMenuId, setSelectedDiapers, setSettingsOpen])

  useEffect(() => {
    if (!openEntryMenuId) return
    const onPointerDown = (event: PointerEvent) => {
      const path = event.composedPath()
      if (path.some((target) => target instanceof Element && target.closest('.entry-action-wrap'))) return
      setOpenEntryMenuId(null)
      setConfirmingDeleteEntryId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [openEntryMenuId, setConfirmingDeleteEntryId, setOpenEntryMenuId])
}
