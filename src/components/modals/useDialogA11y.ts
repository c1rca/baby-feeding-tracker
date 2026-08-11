import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const focusableWithin = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null || element === document.activeElement)

/**
 * The four things every modal owes a keyboard or screen-reader user, applied
 * from one place so each dialog does not reinvent them:
 *
 *  - focus moves into the dialog on open, so the next Tab is inside it
 *  - Tab and Shift+Tab wrap within the dialog rather than escaping to the page
 *  - Escape closes it
 *  - focus returns to whatever opened it on close
 *
 * Attach the returned ref to the element carrying `role="dialog"`.
 */
export function useDialogA11y<T extends HTMLElement>(onClose: () => void) {
  const dialogRef = useRef<T | null>(null)
  // Kept in a ref so a caller passing an inline arrow does not re-run the setup
  // effect and steal focus back on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const initial = focusableWithin(dialog)[0]
    if (initial) initial.focus()
    else {
      dialog.setAttribute('tabindex', '-1')
      dialog.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = focusableWithin(dialog)
      if (!focusable.length) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', onKeyDown)
    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      // Only take focus back if it is still inside the closing dialog; the user
      // may have deliberately moved on.
      if (previouslyFocused?.isConnected && (!document.activeElement || document.activeElement === document.body || dialog.contains(document.activeElement))) {
        previouslyFocused.focus()
      }
    }
  }, [])

  return dialogRef
}
