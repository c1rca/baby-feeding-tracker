import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cmToDisplayLength, displayLengthToCm, displayMassToLb, lbToDisplayMass, type UnitPreferences } from '../../../domain/units'
import { useUnits } from '../../../state/unitPreferencesContext'
import type { BabySummary } from '../../../babies/babyApi'
import { prepareAvatar } from '../../../babies/babyPhoto'
import { BabyAvatar } from '../../BabyAvatar'
import { ConfirmButton, SettingsBadge, SettingsField, SettingsRow, SettingsSection } from './SettingsPrimitives'
import type { SettingsModalProps } from './settingsTypes'

type BabyProfileSettingProps = {
  baby: BabySummary | undefined
  role?: string
  onUpdateBabyProfile?: SettingsModalProps['onUpdateBabyProfile']
  showToast: (message: string) => void
}

const profileDraftFrom = (baby: BabySummary | undefined, units: UnitPreferences) => ({
  sex: baby?.sex ?? ('' as const),
  birthWeight: baby?.birthWeightLb === null || baby?.birthWeightLb === undefined ? '' : String(lbToDisplayMass(baby.birthWeightLb, units.mass)),
  birthLength: baby?.birthLengthCm === null || baby?.birthLengthCm === undefined ? '' : String(cmToDisplayLength(baby.birthLengthCm, units.length)),
  pediatricianName: baby?.pediatricianName ?? '',
  pediatricianPhone: baby?.pediatricianPhone ?? '',
})

export function BabyProfileSetting({ baby, role, onUpdateBabyProfile, showToast }: BabyProfileSettingProps) {
  const { units } = useUnits()
  const canEdit = role === 'owner' || role === 'caregiver'
  const [draft, setDraft] = useState(() => profileDraftFrom(baby, units))
  const [savedBabyId, setSavedBabyId] = useState(baby?.id)
  const [pending, setPending] = useState(false)
  const [photoPending, setPhotoPending] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Switching babies must reload the form rather than leaving another baby's
  // values sitting in the inputs.
  if (baby?.id !== savedBabyId) {
    setSavedBabyId(baby?.id)
    setDraft(profileDraftFrom(baby, units))
  }

  if (!baby) return null

  const save = async () => {
    if (!onUpdateBabyProfile || pending) return
    setPending(true)
    const ok = await onUpdateBabyProfile(baby.id, {
      name: baby.name,
      sex: draft.sex,
      birthWeightLb: draft.birthWeight.trim() === '' ? null : displayMassToLb(Number(draft.birthWeight), units.mass),
      birthLengthCm: draft.birthLength.trim() === '' ? null : displayLengthToCm(Number(draft.birthLength), units.length),
      pediatricianName: draft.pediatricianName,
      pediatricianPhone: draft.pediatricianPhone,
    })
    setPending(false)
    showToast(ok ? 'Baby profile saved' : 'Could not save baby profile')
  }

  const savePhoto = async (photo: string) => {
    if (!onUpdateBabyProfile) return
    setPhotoPending(true)
    const ok = await onUpdateBabyProfile(baby.id, { name: baby.name, photo })
    setPhotoPending(false)
    showToast(ok ? (photo ? 'Photo saved' : 'Photo removed') : 'Could not save the photo')
  }

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoPending(true)
    const result = await prepareAvatar(file)
    setPhotoPending(false)
    if (!result.ok) return showToast(result.error)
    await savePhoto(result.dataUrl)
  }

  return (
    <SettingsSection label="Baby profile" lead="Shared with everyone in the household.">
      <div className="settings-card">
        <SettingsRow
          title="Photo"
          hint="Shrunk to a small square on this device before it is saved, then shared with the household."
          control={(
            <div className="baby-photo-control">
              <BabyAvatar baby={baby} size={40} />
              <input ref={photoInputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Baby photo file" onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = '' }} />
              <button type="button" disabled={!canEdit || photoPending} aria-label="Choose baby photo" onClick={() => photoInputRef.current?.click()}>{photoPending ? 'Working…' : baby.photo ? 'Change' : 'Add'}</button>
              {baby.photo && canEdit ? <button type="button" className="icon-plain" aria-label="Remove baby photo" onClick={() => void savePhoto('')}><X size={15} /></button> : null}
            </div>
          )}
        />
        <SettingsRow
          title="Sex"
          hint="Sets the growth-chart reference — percentiles use the CDC boys’ or girls’ curves to match. Until it’s set, measurements are still plotted but no percentile is shown."
          control={(
            <div className="care-segmented settings-segmented" role="group" aria-label="Baby sex">
              {(['female', 'male'] as const).map((option) => (
                <button key={option} type="button" disabled={!canEdit} aria-pressed={draft.sex === option} className={draft.sex === option ? 'is-active' : ''} onClick={() => setDraft((current) => ({ ...current, sex: option }))}>
                  {option === 'female' ? 'Female' : 'Male'}
                </button>
              ))}
            </div>
          )}
        />
        <SettingsRow
          title="Birth weight"
          hint={`Recorded in ${units.mass}.`}
          control={<span className="settings-number"><input aria-label="Birth weight" inputMode="decimal" disabled={!canEdit} value={draft.birthWeight} onChange={(event) => setDraft((current) => ({ ...current, birthWeight: event.target.value }))} /><span className="settings-number-unit">{units.mass}</span></span>}
        />
        <SettingsRow
          title="Birth length"
          hint={`Recorded in ${units.length}.`}
          control={<span className="settings-number"><input aria-label="Birth length" inputMode="decimal" disabled={!canEdit} value={draft.birthLength} onChange={(event) => setDraft((current) => ({ ...current, birthLength: event.target.value }))} /><span className="settings-number-unit">{units.length}</span></span>}
        />
        <SettingsRow
          title="Pediatrician"
          hint="Shown on the printable care summary."
          control={<input aria-label="Pediatrician name" disabled={!canEdit} value={draft.pediatricianName} onChange={(event) => setDraft((current) => ({ ...current, pediatricianName: event.target.value }))} placeholder="Dr Chen" />}
        />
        <SettingsRow
          title="Pediatrician phone"
          hint="For the 2am “should we call?” moment."
          control={<input aria-label="Pediatrician phone" type="tel" disabled={!canEdit} value={draft.pediatricianPhone} onChange={(event) => setDraft((current) => ({ ...current, pediatricianPhone: event.target.value }))} placeholder="555-0100" />}
        />
        {canEdit ? <div className="settings-actions is-footer"><button type="button" className="primary" disabled={pending} onClick={() => void save()}>{pending ? 'Saving…' : 'Save profile'}</button></div> : null}
      </div>
    </SettingsSection>
  )
}

export function BabyManagementSetting({ babies = [], selectedBabyId = '', role, onCreateBaby, onRenameBaby, onArchiveBaby, showToast }: { babies?: SettingsModalProps['babies']; selectedBabyId?: string; role?: string; onCreateBaby?: SettingsModalProps['onCreateBaby']; onRenameBaby?: SettingsModalProps['onRenameBaby']; onArchiveBaby?: SettingsModalProps['onArchiveBaby']; showToast: (message: string) => void }) {
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [editingBabyId, setEditingBabyId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const canManage = role !== 'viewer' && !!onCreateBaby && !!onRenameBaby && !!onArchiveBaby

  const submitBaby = async () => {
    const trimmedName = name.trim()
    if (!trimmedName || !canManage) return
    const ok = await onCreateBaby({ name: trimmedName, dob: dob || undefined })
    showToast(ok ? 'Baby added' : 'Could not add baby')
    if (ok) {
      setName('')
      setDob('')
    }
  }

  return (
    <SettingsSection label="Babies" lead={canManage ? 'Rename or archive. The active baby cannot be archived.' : undefined}>
      <div className="settings-card">
        {babies.map((baby) => {
          const editing = editingBabyId === baby.id
          const saveName = async () => {
            const nextName = nameDraft.trim()
            if (!nextName || nextName === baby.name || !onRenameBaby) { setEditingBabyId(null); return }
            const ok = await onRenameBaby(baby.id, nextName)
            showToast(ok ? 'Baby name saved' : 'Could not save baby name')
            if (ok) setEditingBabyId(null)
          }
          return (
            <SettingsRow
              key={baby.id}
              title={editing
                ? <input aria-label={`Baby name for ${baby.name}`} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveName(); if (event.key === 'Escape') setEditingBabyId(null) }} autoFocus />
                : baby.name}
              hint={editing ? undefined : baby.id === selectedBabyId ? 'Currently active' : 'Not active'}
              control={canManage ? (editing ? (
                <>
                  <button type="button" className="primary" onClick={() => void saveName()} disabled={!nameDraft.trim()}>Save</button>
                  <button type="button" className="secondary" onClick={() => setEditingBabyId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <button type="button" className="secondary" aria-label={`Edit ${baby.name} name`} onClick={() => { setNameDraft(baby.name); setEditingBabyId(baby.id) }}>Rename</button>
                  {babies.length > 1 ? (
                    <ConfirmButton
                      label="Archive"
                      confirmLabel="Confirm"
                      ariaLabel={`Archive ${baby.name}`}
                      // The active baby cannot be archived — you would be left
                      // looking at a log you can no longer reach.
                      disabled={baby.id === selectedBabyId}
                      onConfirm={() => { void (async () => { const ok = await onArchiveBaby?.(baby.id); showToast(ok ? 'Baby archived' : 'Could not archive baby') })() }}
                    />
                  ) : null}
                </>
              )) : baby.id === selectedBabyId ? <SettingsBadge tone="owner">Active</SettingsBadge> : null}
            />
          )
        })}
        {canManage ? (
          <SettingsRow title="Add a baby" hint="Each baby keeps its own log, goals and trackers." stacked>
            <div className="settings-fieldset">
              <SettingsField label="Name">
                <input aria-label="New baby name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Baby name" />
              </SettingsField>
              <SettingsField label="Date of birth">
                <input aria-label="New baby date of birth" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
              </SettingsField>
            </div>
            <div className="settings-actions">
              <button type="button" className="primary" onClick={submitBaby} disabled={!name.trim()}>Add baby</button>
            </div>
          </SettingsRow>
        ) : null}
      </div>
    </SettingsSection>
  )
}
