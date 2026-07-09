import { useState } from 'react'
import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'
import { BrowserReminderSetting } from './BrowserReminderSetting'
import { GotifyReminderSetting } from './GotifyReminderSetting'
import { SettingsDataControls } from './SettingsDataControls'
import { applySkin, readSkin, skinLabel } from '../../skin'
import { normalizeTummyTimeGoalMinutes } from '../../domain/tummyTime'

type SettingsModalProps = Pick<
  TrackerModalsProps,
  | 'entries'
  | 'diapers'
  | 'babyDob'
  | 'tummyGoalMinutes'
  | 'feedingNotificationsEnabled'
  | 'notificationPermission'
  | 'gotifyAvailable'
  | 'gotifyRemindersEnabled'
  | 'medicineReminderSettings'
  | 'babies'
  | 'selectedBabyId'
  | 'authUser'
  | 'fileInputRef'
  | 'setSettingsOpen'
  | 'setEntries'
  | 'setDiapers'
  | 'setBabyDob'
  | 'setTummyGoalMinutes'
  | 'setSession'
  | 'setUndoState'
  | 'setFeedingNotificationsEnabled'
  | 'enableFeedingNotifications'
  | 'setGotifyReminders'
  | 'setMedicineReminderSettings'
  | 'onCreateBaby'
  | 'onArchiveBaby'
  | 'showToast'
>

function AppearanceSetting() {
  const [skin, setSkin] = useState(readSkin)
  const nextSkin = skin === 'lullaby' ? 'classic' : 'lullaby'

  return (
    <div className="setting-row">
      <span>
        <strong>Design</strong>
        <small>Current: {skinLabel[skin]}. Switch between the new Lullaby design and the classic look on this device.</small>
      </span>
      <button
        type="button"
        aria-label={`Switch to ${skinLabel[nextSkin]} design`}
        onClick={() => {
          applySkin(nextSkin)
          setSkin(nextSkin)
        }}
      >
        Use {skinLabel[nextSkin]}
      </button>
    </div>
  )
}

function BabyManagementSetting({ babies = [], selectedBabyId = '', role, onCreateBaby, onArchiveBaby, showToast }: { babies?: SettingsModalProps['babies']; selectedBabyId?: string; role?: string; onCreateBaby?: SettingsModalProps['onCreateBaby']; onArchiveBaby?: SettingsModalProps['onArchiveBaby']; showToast: (message: string) => void }) {
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const canManage = role !== 'viewer' && !!onCreateBaby && !!onArchiveBaby

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
    <div className="setting-row baby-management-setting">
      <span>
        <strong>Babies</strong>
        <small>{canManage ? 'Add or archive babies in this household.' : 'Your role can view babies but cannot manage them.'}</small>
      </span>
      <div className="setting-stack">
        {canManage ? (
          <div className="settings-inline-form">
            <label>
              <span className="sr-only">New baby name</span>
              <input aria-label="New baby name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Baby name" />
            </label>
            <label>
              <span className="sr-only">New baby date of birth</span>
              <input aria-label="New baby date of birth" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
            </label>
            <button type="button" onClick={submitBaby} disabled={!name.trim()}>Add baby</button>
          </div>
        ) : null}
        <div className="settings-baby-list">
          {babies.map((baby) => (
            <div key={baby.id} className="settings-baby-row">
              <span>{baby.name}{baby.id === selectedBabyId ? ' · active' : ''}</span>
              {canManage && babies.length > 1 ? <button type="button" className="danger" onClick={async () => { const ok = await onArchiveBaby(baby.id); showToast(ok ? 'Baby archived' : 'Could not archive baby') }} disabled={baby.id === selectedBabyId} aria-label={`Archive ${baby.name}`}>Archive</button> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsModal({ entries, diapers, babyDob, tummyGoalMinutes, feedingNotificationsEnabled, notificationPermission, gotifyAvailable, gotifyRemindersEnabled, medicineReminderSettings, babies = [], selectedBabyId = '', authUser = null, fileInputRef, setSettingsOpen, setEntries, setDiapers, setBabyDob, setTummyGoalMinutes, setSession, setUndoState, setFeedingNotificationsEnabled, enableFeedingNotifications, setGotifyReminders, setMedicineReminderSettings, onCreateBaby, onArchiveBaby, showToast }: SettingsModalProps) {
  const [tummyGoalDraft, setTummyGoalDraft] = useState(() => String(tummyGoalMinutes))
  const closeSettings = () => setSettingsOpen(false)

  return (
    <ModalFrame label="Settings and data" className="settings" onClose={closeSettings}>
      <div className="settings-modal-header">
        <h2>Settings & Data</h2>
        <button type="button" className="settings-close-button" aria-label="Close settings" onClick={closeSettings}>
          ×
        </button>
      </div>
      <BrowserReminderSetting
        feedingNotificationsEnabled={feedingNotificationsEnabled}
        notificationPermission={notificationPermission}
        setFeedingNotificationsEnabled={setFeedingNotificationsEnabled}
        enableFeedingNotifications={enableFeedingNotifications}
        showToast={showToast}
      />
      <GotifyReminderSetting
        gotifyAvailable={gotifyAvailable}
        gotifyRemindersEnabled={gotifyRemindersEnabled}
        medicineReminderSettings={medicineReminderSettings}
        setGotifyReminders={setGotifyReminders}
        setMedicineReminderSettings={setMedicineReminderSettings}
      />
      <AppearanceSetting />
      <BabyManagementSetting babies={babies} selectedBabyId={selectedBabyId} role={authUser?.role} onCreateBaby={onCreateBaby} onArchiveBaby={onArchiveBaby} showToast={showToast} />
      <label className="setting-row">
        <span>
          <strong>Baby date of birth</strong>
          <small>Used to auto-calculate growth chart age.</small>
        </span>
        <input type="date" value={babyDob} onChange={(event) => setBabyDob(event.target.value)} />
      </label>
      <label className="setting-row">
        <span>
          <strong>Tummy Time daily goal</strong>
          <small>Used for today progress, Stats, and reminder timing.</small>
        </span>
        <input
          type="number"
          min="1"
          max="240"
          step="1"
          inputMode="numeric"
          value={tummyGoalDraft}
          onChange={(event) => {
            setTummyGoalDraft(event.target.value)
            if (event.target.value !== '') setTummyGoalMinutes(normalizeTummyTimeGoalMinutes(event.target.value))
          }}
          onBlur={() => {
            const normalized = normalizeTummyTimeGoalMinutes(tummyGoalDraft)
            setTummyGoalDraft(String(normalized))
            setTummyGoalMinutes(normalized)
          }}
        />
      </label>
      <SettingsDataControls
        entries={entries}
        diapers={diapers}
        fileInputRef={fileInputRef}
        setEntries={setEntries}
        setDiapers={setDiapers}
        setSession={setSession}
        setUndoState={setUndoState}
        showToast={showToast}
      />
    </ModalFrame>
  )
}
