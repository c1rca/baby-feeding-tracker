import { Baby } from 'lucide-react'
import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'

type BottleModalProps = Pick<TrackerModalsProps, 'session' | 'bottleQuickOz' | 'setBottleOpen' | 'setBottleQuickOz' | 'logBottle'>

export function BottleModal({ session, bottleQuickOz, setBottleOpen, setBottleQuickOz, logBottle }: BottleModalProps) {
  return (
    <ModalFrame label={session ? 'Add bottle to active feed' : 'Quick bottle log'} className="bottle-card" onClose={() => setBottleOpen(false)}>
      <div className="hero-top"><h2>{session ? 'Add Bottle to Active Feed' : 'Quick Bottle Log'}</h2><span className="pill">One tap</span></div>
      <div className="preset-grid">{[2, 2.5, 3, 3.5, 4].map((oz) => <button key={oz} className="preset-btn" onClick={() => { logBottle(oz); setBottleOpen(false) }}>{oz.toFixed(1)} oz</button>)}</div>
      <div className="bottle-custom-row">
        <button onClick={() => setBottleQuickOz((value) => Math.max(0.5, +(value - 0.5).toFixed(1)))}>-</button>
        <strong className="bottle-amount">{bottleQuickOz.toFixed(1)} oz</strong>
        <button onClick={() => setBottleQuickOz((value) => +(value + 0.5).toFixed(1))}>+</button>
        <button className="primary" aria-label="Log bottle" onClick={() => { logBottle(); setBottleOpen(false) }}><Baby size={16} /> Log</button>
      </div>
    </ModalFrame>
  )
}
