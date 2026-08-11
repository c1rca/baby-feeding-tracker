import { Baby, Milk, X } from 'lucide-react'
import { useState } from 'react'
import { ModalFrame } from './ModalFrame'
import { useUnits } from '../../state/unitPreferencesContext'
import { displayVolumeToOz, formatVolume, formatVolumeValue, ozToDisplayVolume, volumePresets, volumeStep, volumeUnitName } from '../../domain/units'
import { BOTTLE_CONTENTS, bottleContentLabel } from '../../domain/labels'
import { readLastBottleContent, persistLastBottleContent } from '../../state/bottleContentPreference'
import type { TrackerModalsProps } from './modalTypes'

type BottleModalProps = Pick<TrackerModalsProps, 'session' | 'bottleQuickOz' | 'setBottleOpen' | 'setBottleQuickOz' | 'logBottle'>

export function BottleModal({ session, bottleQuickOz, setBottleOpen, setBottleQuickOz, logBottle }: BottleModalProps) {
  const { units } = useUnits()
  // Most households pour the same thing every time, so the sheet opens on
  // whatever was logged last rather than making it a required choice.
  const [content, setContent] = useState(readLastBottleContent)
  const close = () => setBottleOpen(false)
  const save = (oz = bottleQuickOz) => { persistLastBottleContent(content); logBottle(oz, content); close() }
  const step = volumeStep(units.volume)
  // The stepper nudges in whatever unit is on screen, then stores canonical
  // ounces — so a millilitre user moves in tens, not in 0.338 oz increments.
  const nudge = (direction: 1 | -1) => setBottleQuickOz((value) => {
    const next = ozToDisplayVolume(value, units.volume) + direction * step
    return displayVolumeToOz(Math.max(step, +next.toFixed(2)), units.volume)
  })
  return (
    <ModalFrame label={session ? 'Add bottle to active feed' : 'Quick bottle log'} className="care-sheet bottle-sheet" onClose={close}>
      <header>
        <div><span className="care-sheet-eyebrow">Bottle feed</span><h2>{session ? 'Add bottle to this feed' : 'Log a bottle'}</h2><p>{session ? 'Add the amount now. It will save with the active feed.' : 'Choose an amount or fine-tune it below.'}</p></div>
        <button type="button" className="icon-plain" aria-label="Close bottle log" onClick={close}><X size={16} /></button>
      </header>
      <div className="care-segmented bottle-content-picker" role="group" aria-label="Bottle contents">
        {BOTTLE_CONTENTS.map((option) => (
          <button key={option} type="button" aria-pressed={content === option} className={content === option ? 'is-active' : ''} onClick={() => setContent(option)}>{bottleContentLabel(option)}</button>
        ))}
      </div>
      <div className="bottle-quick-amounts" role="group" aria-label="Bottle amount presets">
        {volumePresets(units.volume).map((amount) => <button type="button" key={amount} onClick={() => save(displayVolumeToOz(amount, units.volume))}><Milk size={17} /><strong>{units.volume === 'ml' ? amount : amount.toFixed(1)}</strong><span>{volumeUnitName(units.volume)}</span></button>)}
      </div>
      <div className="bottle-fine-tune"><span>Custom amount</span><div><button type="button" aria-label="Decrease bottle amount" onClick={() => nudge(-1)}>−</button><strong>{formatVolumeValue(bottleQuickOz, units.volume)} <small>{units.volume}</small></strong><button type="button" aria-label="Increase bottle amount" onClick={() => nudge(1)}>+</button></div></div>
      <button type="button" className="primary bottle-save" aria-label="Log bottle" onClick={() => save()}><Baby size={17} /> Log {formatVolume(bottleQuickOz, units.volume)}</button>
    </ModalFrame>
  )
}
