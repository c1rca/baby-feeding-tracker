import type { ReactNode } from 'react'

export function ModalFrame({ label, className, onClose, children }: { label: string; className: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className={`card modal-card ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
        {children}
      </section>
    </div>
  )
}
