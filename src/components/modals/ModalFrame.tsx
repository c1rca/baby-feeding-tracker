import type { ReactNode } from 'react'
import { useDialogA11y } from './useDialogA11y'

export function ModalFrame({ label, className, onClose, children }: { label: string; className: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useDialogA11y<HTMLElement>(onClose)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section ref={dialogRef} className={`card modal-card ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
        {children}
      </section>
    </div>
  )
}

/**
 * The same dialog behaviour for surfaces that carry their own markup and class
 * names (the care sheets), so they are not left as the one family of dialogs
 * without focus handling.
 */
export function DialogSurface({ label, backdropClassName = 'modal-backdrop', className, onClose, children }: { label: string; backdropClassName?: string; className: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose)
  return (
    <div className={backdropClassName} onClick={onClose}>
      <div ref={dialogRef} className={className} role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
