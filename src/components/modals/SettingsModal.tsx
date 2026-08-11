import { useRef, useState, type ComponentType, type KeyboardEvent } from 'react'
import { Baby, Bell, Database, Palette, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react'
import { ModalFrame } from './ModalFrame'
import { NotificationSettings } from './notifications/NotificationSettings'
import { SettingsDataControls } from './SettingsDataControls'
import { CustomTrackersSetting } from './settings/CustomTrackersTab'
import { normalizeTummyTimeGoalMinutes } from '../../domain/tummyTime'
import { AppearanceSetting, UnitsSetting } from './settings/AppearanceTab'
import { AccountSecuritySetting } from './settings/AccountTab'
import { HouseholdAccessSetting } from './settings/HouseholdTab'
import { BabyManagementSetting, BabyProfileSetting } from './settings/BabyTab'
import { ProfileSetting } from './settings/ProfileTab'
import { AiCareAssistant } from './settings/AiCareAssistant'
import { SettingsRow, SettingsSection } from './settings/SettingsPrimitives'
import type { SettingsModalProps } from './settings/settingsTypes'

type TabId = 'profile' | 'reminders' | 'assistant' | 'baby' | 'household' | 'appearance' | 'account' | 'data'

type TabDef = {
  id: TabId
  label: string
  icon: ComponentType<{ size?: number | string }>
  title: string
  blurb: string
}

const TAB_ORDER: TabDef[] = [
  { id: 'profile', label: 'Profile', icon: UserRound, title: 'Your profile', blurb: 'The name and greeting shown throughout your tracker.' },
  { id: 'reminders', label: 'Notifications', icon: Bell, title: 'Notifications', blurb: 'Premium notification control — choose which types alert you, how, and when.' },
  { id: 'assistant', label: 'Ask Feedr AI', icon: Sparkles, title: 'Ask Feedr AI', blurb: 'Private answers grounded in your active baby’s tracker data.' },
  { id: 'baby', label: 'Baby', icon: Baby, title: 'Baby profile', blurb: 'Roster, birth date, and the daily tummy-time goal.' },
  { id: 'household', label: 'Household', icon: Users, title: 'Household access', blurb: 'Invite caregivers and manage who can do what.' },
  { id: 'appearance', label: 'Appearance', icon: Palette, title: 'Appearance', blurb: 'Theme, layout, and units — remembered on this device.' },
  { id: 'account', label: 'Account', icon: ShieldCheck, title: 'Account security', blurb: 'Your identity, password, and sign-out.' },
  { id: 'data', label: 'Data', icon: Database, title: 'Data', blurb: 'Export, import, or clear the log on this device.' },
]

export function SettingsModal({ entries, diapers, medicines, tummyTimes, pumpEvents, pumpSession, tummySession, growthMeasurements, healthRecords, customTrackers, setCustomTrackers, session, babyDob, tummyGoalMinutes, pumpGoalOunces, pumpGoalSessions, setPumpGoalOunces, setPumpGoalSessions, browserRemindersEnabled, liveSyncEnabled = true, notificationPermission, notificationPreferences, gotifyAvailable, babies = [], selectedBabyId = '', authUser = null, profileName = 'Mom', setProfileName = () => undefined, theme, onLogout, fileInputRef, setSettingsOpen, setEntries, setDiapers, setMedicines, setTummyTimes, setPumpEvents, setPumpSession, setTummySession, setGrowthMeasurements, setHealthRecords, setBabyDob, setTummyGoalMinutes, setSession, setUndoState, setBrowserRemindersEnabled, setLiveSyncEnabled, setNotificationPreferences, setTheme, enableBrowserReminders, onCreateBaby, onRenameBaby, onUpdateBabyProfile, onArchiveBaby, showToast, initialTab }: SettingsModalProps) {  const [tummyGoalDraft, setTummyGoalDraft] = useState(() => String(tummyGoalMinutes))
  const [pumpOzGoalDraft, setPumpOzGoalDraft] = useState(() => String(pumpGoalOunces))
  const [pumpSessionsGoalDraft, setPumpSessionsGoalDraft] = useState(() => String(pumpGoalSessions))
  const clampPumpGoalInput = (value: string, max: number) => { const n = Math.round(Number(value)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0 }
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'reminders')
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
                  // Narrow layouts collapse the tablist to icons and only the
                  // selected tab keeps its visible label, which left every other
                  // tab with no accessible name at all — unreachable by a screen
                  // reader and indistinguishable to anything driving the UI.
                  // The label is the name whether or not it is painted.
                  aria-label={tab.label}
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
            {active.id === 'profile' ? <ProfileSetting profileName={profileName} setProfileName={setProfileName} /> : null}
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
            {active.id === 'assistant' ? <AiCareAssistant /> : null}

            {active.id === 'baby' ? (
              <>
                <BabyManagementSetting babies={babies} selectedBabyId={selectedBabyId} role={authUser?.role} onCreateBaby={onCreateBaby} onRenameBaby={onRenameBaby} onArchiveBaby={onArchiveBaby} showToast={showToast} />
                <BabyProfileSetting baby={babies.find((item) => item.id === selectedBabyId)} role={authUser?.role} onUpdateBabyProfile={onUpdateBabyProfile} showToast={showToast} />
                <SettingsSection label="Daily goals" lead="What counts as done each day. Drives Today's needs, Insights and reminders.">
                  <div className="settings-card">
                    <SettingsRow
                      title="Date of birth"
                      hint="Auto-calculates growth-chart age."
                      control={<input aria-label="Baby date of birth" type="date" value={babyDob} onChange={(event) => setBabyDob(event.target.value)} />}
                    />
                    <SettingsRow
                      title="Tummy time"
                      hint="Today's target for tummy and play time."
                      control={(
                        <span className="settings-number">
                          <input
                            aria-label="Tummy Time daily goal"
                            type="number" min="1" max="240" step="1" inputMode="numeric"
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
                      )}
                    />
                    <SettingsRow
                      title="Pumping output"
                      hint="Shows in Today's needs when set. 0 turns it off."
                      control={(
                        <span className="settings-number">
                          <input
                            aria-label="Daily pumping ounces goal"
                            type="number" min="0" max="500" step="1" inputMode="numeric"
                            value={pumpOzGoalDraft}
                            onChange={(event) => {
                              setPumpOzGoalDraft(event.target.value)
                              if (event.target.value !== '') setPumpGoalOunces(clampPumpGoalInput(event.target.value, 500))
                            }}
                            onBlur={() => {
                              const normalized = clampPumpGoalInput(pumpOzGoalDraft, 500)
                              setPumpOzGoalDraft(String(normalized))
                              setPumpGoalOunces(normalized)
                            }}
                          />
                          <span className="settings-number-unit">oz</span>
                        </span>
                      )}
                    />
                    <SettingsRow
                      title="Pumping sessions"
                      hint="Shows in Today's needs when set. 0 turns it off."
                      control={(
                        <span className="settings-number">
                          <input
                            aria-label="Daily pumping sessions goal"
                            type="number" min="0" max="50" step="1" inputMode="numeric"
                            value={pumpSessionsGoalDraft}
                            onChange={(event) => {
                              setPumpSessionsGoalDraft(event.target.value)
                              if (event.target.value !== '') setPumpGoalSessions(clampPumpGoalInput(event.target.value, 50))
                            }}
                            onBlur={() => {
                              const normalized = clampPumpGoalInput(pumpSessionsGoalDraft, 50)
                              setPumpSessionsGoalDraft(String(normalized))
                              setPumpGoalSessions(normalized)
                            }}
                          />
                          <span className="settings-number-unit">/day</span>
                        </span>
                      )}
                    />
                  </div>
                </SettingsSection>
                <CustomTrackersSetting customTrackers={customTrackers} setCustomTrackers={setCustomTrackers} showToast={showToast} />
              </>
            ) : null}

            {active.id === 'household' ? (
              <HouseholdAccessSetting role={authUser?.role} showToast={showToast} />
            ) : null}

            {active.id === 'appearance' ? (
              <>
                <AppearanceSetting theme={theme} setTheme={setTheme} liveSyncEnabled={liveSyncEnabled} setLiveSyncEnabled={setLiveSyncEnabled} />
                <UnitsSetting />
              </>
            ) : null}

            {active.id === 'account' ? (
              <AccountSecuritySetting authUser={authUser} onLogout={onLogout} showToast={showToast} />
            ) : null}

            {active.id === 'data' ? (
              <SettingsDataControls
                selectedBabyId={selectedBabyId}
                entries={entries}
                diapers={diapers}
                medicines={medicines}
                tummyTimes={tummyTimes}
                pumpEvents={pumpEvents}
                pumpSession={pumpSession}
                tummySession={tummySession}
                growthMeasurements={growthMeasurements}
                healthRecords={healthRecords}
                babyDob={babyDob}
                tummyGoalMinutes={tummyGoalMinutes}
                pumpGoalOunces={pumpGoalOunces}
                pumpGoalSessions={pumpGoalSessions}
                session={session}
                theme={theme}
                babyName={babies?.find((baby) => baby.id === selectedBabyId)?.name}
                babyProfile={babies?.find((baby) => baby.id === selectedBabyId)}
                fileInputRef={fileInputRef}
                setEntries={setEntries}
                setDiapers={setDiapers}
                setMedicines={setMedicines}
                setTummyTimes={setTummyTimes}
                setPumpEvents={setPumpEvents}
                setPumpSession={setPumpSession}
                setTummySession={setTummySession}
                setGrowthMeasurements={setGrowthMeasurements}
                setHealthRecords={setHealthRecords}
                setTummyGoalMinutes={setTummyGoalMinutes}
                setPumpGoalOunces={setPumpGoalOunces}
                setPumpGoalSessions={setPumpGoalSessions}
                setBabyDob={setBabyDob}
                setTheme={setTheme}
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
