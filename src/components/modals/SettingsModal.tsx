import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react'
import { Baby, Bell, Database, Palette, ShieldCheck, Users } from 'lucide-react'
import { ModalFrame } from './ModalFrame'
import type { TrackerModalsProps } from './modalTypes'
import { NotificationSettings } from './notifications/NotificationSettings'
import { SettingsDataControls } from './SettingsDataControls'
import { applySkin, readSkin } from '../../skin'
import { SettingToggle } from './SettingToggle'
import { normalizeTummyTimeGoalMinutes } from '../../domain/tummyTime'
import { changePassword } from '../../auth/authApi'
import { createHouseholdInvite, fetchHouseholdAccess, revokeHouseholdInvite, updateHouseholdMemberRole, type HouseholdInvite, type HouseholdMember } from '../../household/accessApi'

type SettingsModalProps = Pick<
  TrackerModalsProps,
  | 'entries'
  | 'diapers'
  | 'babyDob'
  | 'tummyGoalMinutes'
  | 'feedingNotificationsEnabled'
  | 'browserRemindersEnabled'
  | 'notificationPermission'
  | 'notificationPreferences'
  | 'gotifyAvailable'
  | 'gotifyRemindersEnabled'
  | 'medicineReminderSettings'
  | 'babies'
  | 'selectedBabyId'
  | 'authUser'
  | 'profileName'
  | 'setProfileName'
  | 'theme'
  | 'onLogout'
  | 'fileInputRef'
  | 'setSettingsOpen'
  | 'setEntries'
  | 'setDiapers'
  | 'setBabyDob'
  | 'setTummyGoalMinutes'
  | 'setSession'
  | 'setUndoState'
  | 'setFeedingNotificationsEnabled'
  | 'setBrowserRemindersEnabled'
  | 'liveSyncEnabled'
  | 'setLiveSyncEnabled'
  | 'setNotificationPreferences'
  | 'setTheme'
  | 'enableBrowserReminders'
  | 'setGotifyReminders'
  | 'setMedicineReminderSettings'
  | 'onCreateBaby'
  | 'onRenameBaby'
  | 'onArchiveBaby'
  | 'showToast'
>

function AppearanceSetting({ theme, setTheme, liveSyncEnabled = true, setLiveSyncEnabled }: { theme: 'light' | 'dark'; setTheme: (theme: 'light' | 'dark') => void; liveSyncEnabled?: boolean; setLiveSyncEnabled?: (enabled: boolean) => void }) {
  const [skin, setSkin] = useState(readSkin)

  return (
    <div className="settings-card">
      <div className="setting-row">
        <span className="setting-row-text">
          <strong>Live sync</strong>
          <small>Show other devices' changes in real time as they happen. Turn off to fall back to sync-on-open on this device.</small>
        </span>
        <SettingToggle checked={liveSyncEnabled} onChange={(next) => setLiveSyncEnabled?.(next)} label="Live sync" disabled={!setLiveSyncEnabled} />
      </div>
      <div className="setting-row">
        <span className="setting-row-text">
          <strong>Dark mode</strong>
          <small>Switch between the light and dark palette.</small>
        </span>
        <SettingToggle checked={theme === 'dark'} onChange={(next) => setTheme(next ? 'dark' : 'light')} label="Dark mode" />
      </div>
      <div className="setting-row">
        <span className="setting-row-text">
          <strong>Classic design</strong>
          <small>Use the simpler classic look instead of Lullaby on this device.</small>
        </span>
        <SettingToggle
          checked={skin === 'classic'}
          onChange={(next) => {
            const target = next ? 'classic' : 'lullaby'
            applySkin(target)
            setSkin(target)
          }}
          label="Classic design"
        />
      </div>
    </div>
  )
}

function AccountSecuritySetting({ authUser, onLogout, showToast }: { authUser: SettingsModalProps['authUser']; onLogout?: SettingsModalProps['onLogout']; showToast: (message: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const canChangePassword = authUser?.mode === 'session'
  const identity = authUser?.email || authUser?.displayName || authUser?.id || 'Local caregiver'

  const submitPassword = async () => {
    if (!canChangePassword || pending) return
    if (newPassword.length < 12) {
      setMessage({ kind: 'error', text: 'Use at least 12 characters.' })
      return
    }
    setPending(true)
    setMessage(null)
    const result = await changePassword(currentPassword, newPassword)
    setPending(false)
    if (result.ok) {
      setCurrentPassword('')
      setNewPassword('')
      setMessage({ kind: 'success', text: 'Password updated' })
      showToast('Password updated')
    } else {
      setMessage({ kind: 'error', text: result.error })
    }
  }

  return (
    <div className="settings-group" aria-label="Account security">
      <p className="settings-lead">{canChangePassword ? `Signed in as ${identity}. Update the shared caregiver password without disrupting this device.` : 'Authentication is bypassed or disabled on this device — no password to manage here.'}</p>
      {canChangePassword ? (
        <div className="settings-card">
          <div className="settings-form password-form">
            <label>
              <span>Current password</span>
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label>
              <span>New password</span>
              <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <button type="button" className="primary" onClick={submitPassword} disabled={pending || !newPassword}>{pending ? 'Updating…' : 'Update password'}</button>
            {message ? <p className={`settings-form-msg ${message.kind === 'success' ? 'is-success' : 'is-error'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
          </div>
          {onLogout ? (
            <div className="setting-row">
              <span className="setting-row-text">
                <strong>Sign out</strong>
                <small>End this session on this device.</small>
              </span>
              <button type="button" className="secondary" onClick={onLogout}>Sign out</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function HouseholdAccessSetting({ role, showToast }: { role?: string; showToast: (message: string) => void }) {
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [invites, setInvites] = useState<HouseholdInvite[]>([])
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'caregiver' | 'viewer'>('caregiver')
  const [lastToken, setLastToken] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const canManage = role === 'owner'

  useEffect(() => {
    let cancelled = false
    const loadAccess = async () => {
      if (!role || role === 'viewer') return
      const result = await fetchHouseholdAccess()
      if (cancelled) return
      if (result.ok) {
        setMembers(result.members)
        setInvites(result.invites)
      } else {
        setMessage(result.error)
      }
    }
    void loadAccess()
    return () => { cancelled = true }
  }, [role])

  const sendInvite = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !canManage) return
    const result = await createHouseholdInvite(trimmedEmail, inviteRole)
    if (result.ok) {
      setInvites((current) => [...current, result.invite])
      setLastToken(result.invite.token || '')
      setEmail('')
      showToast('Invite created')
    } else {
      setMessage(result.error)
    }
  }

  const revokeInvite = async (invite: HouseholdInvite) => {
    const result = await revokeHouseholdInvite(invite.id)
    if (result.ok) {
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      showToast('Invite revoked')
    } else setMessage(result.error)
  }

  const updateRole = async (member: HouseholdMember, nextRole: 'caregiver' | 'viewer') => {
    const result = await updateHouseholdMemberRole(member.userId, nextRole)
    if (result.ok) {
      setMembers((current) => current.map((item) => item.userId === member.userId ? { ...item, role: nextRole } : item))
      showToast('Member role updated')
    } else setMessage(result.error)
  }

  if (!role || role === 'viewer') return null
  return (
    <div className="settings-group" aria-label="Household access">
      <p className="settings-lead">{canManage ? 'Invite caregivers and manage each person’s role.' : 'Caregivers and pending invites in this household.'}</p>
      {canManage ? (
        <div className="settings-card">
          <div className="settings-form invite-form">
            <label><span>Invite email or mobile</span><input aria-label="Invite email or mobile" type="text" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="caregiver@example.com or (555) 123-4567" /></label>
            <label><span>Role</span><select aria-label="Invite role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'caregiver' | 'viewer')}><option value="caregiver">Caregiver</option><option value="viewer">Viewer</option></select></label>
            <button type="button" className="primary" onClick={sendInvite} disabled={!email.trim()}>Send invite</button>
          </div>
        </div>
      ) : null}
      {lastToken ? <p className="settings-form-msg is-success" role="status">Invite token: <code>{lastToken}</code></p> : null}
      {message ? <p className="settings-form-msg is-error" role="alert">{message}</p> : null}
      <div className="settings-card">
        {members.map((member) => {
          const label = member.email || member.displayName || member.userId
          return (
            <div className="setting-row settings-list-row" key={member.userId}>
              <span><strong>{label}</strong><small>{member.role}</small></span>
              {canManage && member.role !== 'owner' ? <span className="settings-select"><select aria-label={`Role for ${label}`} value={member.role} onChange={(event) => updateRole(member, event.target.value as 'caregiver' | 'viewer')}><option value="caregiver">Caregiver</option><option value="viewer">Viewer</option></select></span> : null}
            </div>
          )
        })}
        {invites.map((invite) => (
          <div className="setting-row settings-list-row" key={invite.id}>
            <span><strong>{invite.email}</strong><small>Pending · {invite.role}</small></span>
            {canManage ? <button type="button" className="danger" aria-label={`Revoke invite for ${invite.email}`} onClick={() => revokeInvite(invite)}>Revoke</button> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function BabyManagementSetting({ babies = [], selectedBabyId = '', role, onCreateBaby, onRenameBaby, onArchiveBaby, showToast }: { babies?: SettingsModalProps['babies']; selectedBabyId?: string; role?: string; onCreateBaby?: SettingsModalProps['onCreateBaby']; onRenameBaby?: SettingsModalProps['onRenameBaby']; onArchiveBaby?: SettingsModalProps['onArchiveBaby']; showToast: (message: string) => void }) {
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
    <div className="settings-group">
      <p className="settings-group-label">Babies</p>
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
            <div key={baby.id} className="setting-row settings-list-row baby-name-row">
              <span>{editing ? <input aria-label={`Baby name for ${baby.name}`} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveName(); if (event.key === 'Escape') setEditingBabyId(null) }} autoFocus /> : <><strong>{baby.name}</strong>{baby.id === selectedBabyId ? <small>Active</small> : null}</>}</span>
              {canManage ? <span className="baby-row-actions">{editing ? <><button type="button" className="primary" onClick={() => void saveName()} disabled={!nameDraft.trim()}>Save</button><button type="button" className="secondary" onClick={() => setEditingBabyId(null)}>Cancel</button></> : <button type="button" className="secondary" aria-label={`Edit ${baby.name} name`} onClick={() => { setNameDraft(baby.name); setEditingBabyId(baby.id) }}>Edit name</button>}{babies.length > 1 ? <button type="button" className="danger" onClick={async () => { const ok = await onArchiveBaby?.(baby.id); showToast(ok ? 'Baby archived' : 'Could not archive baby') }} disabled={baby.id === selectedBabyId} aria-label={`Archive ${baby.name}`}>Archive</button> : null}</span> : null}
            </div>
          )
        })}
        {canManage ? (
          <div className="settings-form invite-form">
            <label>
              <span>New baby name</span>
              <input aria-label="New baby name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Baby name" />
            </label>
            <label>
              <span>Date of birth</span>
              <input aria-label="New baby date of birth" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
            </label>
            <button type="button" className="primary" onClick={submitBaby} disabled={!name.trim()}>Add baby</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ProfileSetting({ profileName, setProfileName, showToast }: { profileName: string; setProfileName: (name: string) => void; showToast: (message: string) => void }) {
  const [draft, setDraft] = useState(profileName)
  const save = () => { const next = draft.trim() || 'Mom'; setProfileName(next); setDraft(next); showToast('Profile name saved') }
  return <div className="settings-group" aria-label="Profile"><p className="settings-lead">Choose the name used in your greeting and profile avatar.</p><div className="settings-card"><div className="settings-form"><label><span>Your name</span><input aria-label="Your profile name" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Mom" /></label><button type="button" className="primary" onClick={save}>Save profile</button></div></div></div>
}

type TabId = 'profile' | 'reminders' | 'baby' | 'household' | 'appearance' | 'account' | 'data'

type TabDef = {
  id: TabId
  label: string
  icon: ComponentType<{ size?: number | string }>
  title: string
  blurb: string
}

const TAB_ORDER: TabDef[] = [
  { id: 'profile', label: 'Profile', icon: Baby, title: 'Your profile', blurb: 'The name and greeting shown throughout your tracker.' },
  { id: 'reminders', label: 'Notifications', icon: Bell, title: 'Notifications', blurb: 'Premium notification control — choose which types alert you, how, and when.' },
  { id: 'baby', label: 'Baby', icon: Baby, title: 'Baby profile', blurb: 'Roster, birth date, and the daily tummy-time goal.' },
  { id: 'household', label: 'Household', icon: Users, title: 'Household access', blurb: 'Invite caregivers and manage who can do what.' },
  { id: 'appearance', label: 'Appearance', icon: Palette, title: 'Appearance', blurb: 'Theme and layout — remembered on this device.' },
  { id: 'account', label: 'Account', icon: ShieldCheck, title: 'Account security', blurb: 'Your identity, password, and sign-out.' },
  { id: 'data', label: 'Data', icon: Database, title: 'Data', blurb: 'Export, import, or clear the log on this device.' },
]

export function SettingsModal({ entries, diapers, babyDob, tummyGoalMinutes, browserRemindersEnabled, liveSyncEnabled = true, notificationPermission, notificationPreferences, gotifyAvailable, babies = [], selectedBabyId = '', authUser = null, profileName = 'Mom', setProfileName = () => undefined, theme, onLogout, fileInputRef, setSettingsOpen, setEntries, setDiapers, setBabyDob, setTummyGoalMinutes, setSession, setUndoState, setBrowserRemindersEnabled, setLiveSyncEnabled, setNotificationPreferences, setTheme, enableBrowserReminders, onCreateBaby, onRenameBaby, onArchiveBaby, showToast }: SettingsModalProps) {
  const [tummyGoalDraft, setTummyGoalDraft] = useState(() => String(tummyGoalMinutes))
  const [activeTab, setActiveTab] = useState<TabId>('reminders')
  const tablistRef = useRef<HTMLDivElement>(null)
  const closeSettings = () => setSettingsOpen(false)

  const showHousehold = authUser?.role === 'owner' || authUser?.role === 'caregiver'
  const tabs = TAB_ORDER.filter((tab) => tab.id !== 'household' || showHousehold)
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  const focusTab = (id: TabId) => {
    setActiveTab(id)
    requestAnimationFrame(() => tablistRef.current?.querySelector<HTMLButtonElement>(`#settings-tab-${id}`)?.focus())
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === active.id)
    const nextIndex = event.key === 'ArrowDown' || event.key === 'ArrowRight'
      ? (currentIndex + 1) % tabs.length
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : null
    if (nextIndex === null) return
    event.preventDefault()
    focusTab(tabs[nextIndex].id)
  }

  return (
    <ModalFrame label="Settings and data" className="settings" onClose={closeSettings}>
      <div className="settings-shell">
        <nav className="settings-rail" aria-label="Settings sections">
          <div className="settings-rail-brand">
            <span className="settings-rail-eyebrow">Feedr</span>
            <h2 id="settings-title">Settings</h2>
          </div>
          <div className="settings-tablist" role="tablist" aria-orientation="vertical" aria-labelledby="settings-title" ref={tablistRef} onKeyDown={onTabKeyDown}>
            {tabs.map((tab) => {
              const isActive = tab.id === active.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`settings-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls="settings-tabpanel"
                  tabIndex={isActive ? 0 : -1}
                  className={`settings-tab${isActive ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="settings-tab-icon" aria-hidden="true"><Icon size={17} /></span>
                  <span className="settings-tab-label">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="settings-panel">
          <div className="settings-panel-head">
            <div>
              <h3>{active.title}</h3>
              <p>{active.blurb}</p>
            </div>
            <button type="button" className="settings-close-button" aria-label="Close settings" onClick={closeSettings}>×</button>
          </div>

          <div className="settings-panel-body" id="settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${active.id}`} tabIndex={0}>
            {active.id === 'profile' ? <ProfileSetting profileName={profileName} setProfileName={setProfileName} showToast={showToast} /> : null}
            {active.id === 'reminders' ? (
              <NotificationSettings
                notificationPreferences={notificationPreferences}
                browserRemindersEnabled={browserRemindersEnabled}
                notificationPermission={notificationPermission}
                gotifyAvailable={gotifyAvailable}
                setNotificationPreferences={setNotificationPreferences}
                setBrowserRemindersEnabled={setBrowserRemindersEnabled}
                enableBrowserReminders={enableBrowserReminders}
                showToast={showToast}
              />
            ) : null}

            {active.id === 'baby' ? (
              <>
                <BabyManagementSetting babies={babies} selectedBabyId={selectedBabyId} role={authUser?.role} onCreateBaby={onCreateBaby} onRenameBaby={onRenameBaby} onArchiveBaby={onArchiveBaby} showToast={showToast} />
                <div className="settings-card">
                  <label className="setting-row">
                    <span className="setting-row-text">
                      <strong>Date of birth</strong>
                      <small>Auto-calculates growth-chart age.</small>
                    </span>
                    <input aria-label="Baby date of birth" type="date" value={babyDob} onChange={(event) => setBabyDob(event.target.value)} />
                  </label>
                  <label className="setting-row">
                    <span className="setting-row-text">
                      <strong>Daily tummy-time goal</strong>
                      <small>Drives today’s progress, Stats, and reminders.</small>
                    </span>
                    <span className="settings-number">
                      <input
                        aria-label="Tummy Time daily goal"
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
                      <span className="settings-number-unit">min</span>
                    </span>
                  </label>
                </div>
              </>
            ) : null}

            {active.id === 'household' ? (
              <HouseholdAccessSetting role={authUser?.role} showToast={showToast} />
            ) : null}

            {active.id === 'appearance' ? (
              <AppearanceSetting theme={theme} setTheme={setTheme} liveSyncEnabled={liveSyncEnabled} setLiveSyncEnabled={setLiveSyncEnabled} />
            ) : null}

            {active.id === 'account' ? (
              <AccountSecuritySetting authUser={authUser} onLogout={onLogout} showToast={showToast} />
            ) : null}

            {active.id === 'data' ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}
