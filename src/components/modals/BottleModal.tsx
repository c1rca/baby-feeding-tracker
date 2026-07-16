import { Baby, Milk, X } from 'lucide-react'
import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'

type BottleModalProps = Pick<TrackerModalsProps, 'session' | 'bottleQuickOz' | 'setBottleOpen' | 'setBottleQuickOz' | 'logBottle'>

export function BottleModal({ session, bottleQuickOz, setBottleOpen, setBottleQuickOz, logBottle }: BottleModalProps) {
  const close = () => setBottleOpen(false)
  const save = (oz = bottleQuickOz) => { logBottle(oz); close() }
  return (
    <ModalFrame label={session ? 'Add bottle to active feed' : 'Quick bottle log'} className="care-sheet bottle-sheet" onClose={close}>
      <header>
        <div><span className="care-sheet-eyebrow">Bottle feed</span><h2>{session ? 'Add bottle to this feed' : 'Log a bottle'}</h2><p>{session ? 'Add the amount now. It will save with the active feed.' : 'Choose an amount or fine-tune it below.'}</p></div>
        <button type="button" className="icon-plain" aria-label="Close bottle log" onClick={close}><X size={16} /></button>
      </header>
      <div className="bottle-quick-amounts" role="group" aria-label="Bottle amount presets">
        {[2, 2.5, 3, 3.5, 4].map((oz) => <button type="button" key={oz} onClick={() => save(oz)}><Milk size={17} /><strong>{oz.toFixed(1)}</strong><span>ounces</span></button>)}
      </div>
      <div className="bottle-fine-tune"><span>Custom amount</span><div><button type="button" aria-label="Decrease bottle amount" onClick={() => setBottleQuickOz((value) => Math.max(0.5, +(value - 0.5).toFixed(1)))}>−</button><strong>{bottleQuickOz.toFixed(1)} <small>oz</small></strong><button type="button" aria-label="Increase bottle amount" onClick={() => setBottleQuickOz((value) => +(value + 0.5).toFixed(1))}>+</button></div></div>
      <button type="button" className="primary bottle-save" aria-label="Log bottle" onClick={() => save()}><Baby size={17} /> Log {bottleQuickOz.toFixed(1)} oz</button>
    </ModalFrame>
  )
}
