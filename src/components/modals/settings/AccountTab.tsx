import { useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { changePassword, enrollPasskey } from '../../../auth/authApi'
import type { SettingsModalProps } from './settingsTypes'
import { InlineMessage, SettingsBadge, SettingsEmpty, SettingsField, SettingsRow, SettingsSection } from './SettingsPrimitives'

const MIN_PASSWORD = 12

export function AccountSecuritySetting({ authUser, onLogout, showToast }: { authUser: SettingsModalProps['authUser']; onLogout?: SettingsModalProps['onLogout']; showToast: (message: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [passkeyPending, setPasskeyPending] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const canChangePassword = authUser?.mode === 'session'
  const identity = authUser?.email || authUser?.displayName || authUser?.id || 'Local caregiver'

  const submitPassword = async () => {
    if (!canChangePassword || pending) return
    if (newPassword.length < MIN_PASSWORD) {
      setMessage({ kind: 'error', text: `Use at least ${MIN_PASSWORD} characters.` })
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

  const addPasskey = async () => {
    if (!canChangePassword || passkeyPending) return
    setPasskeyPending(true)
    setMessage(null)
    const result = await enrollPasskey()
    setPasskeyPending(false)
    if (result.ok) {
      setMessage({ kind: 'success', text: 'Passkey added to this account' })
      showToast('Passkey added')
    } else setMessage({ kind: 'error', text: result.error })
  }

  // Auth off is a legitimate state, not a blank tab. Say which state it is and
  // that there is nothing to do, rather than rendering a lone paragraph.
  if (!canChangePassword) {
    return (
      <SettingsSection label="Account">
        <SettingsEmpty
          icon={ShieldOff}
          title="No password on this device"
          body="Authentication is bypassed or disabled here, so there is no password to change and no session to end."
        />
      </SettingsSection>
    )
  }

  return (
    <>
      <SettingsSection label="Signed in as">
        <div className="settings-card">
          <SettingsRow
            title={identity}
            hint="Your identity in this household."
            control={<SettingsBadge tone="owner">{authUser?.role ?? 'caregiver'}</SettingsBadge>}
          />
        </div>
      </SettingsSection>

      <SettingsSection label="Passkeys" lead="Add a device passkey for secure password-free sign-in.">
        <div className="settings-card">
          <SettingsRow title="Add passkey" hint="Use this device's fingerprint, face, or screen lock to sign in next time." control={<button type="button" className="secondary" onClick={addPasskey} disabled={passkeyPending}>{passkeyPending ? 'Adding…' : 'Add passkey'}</button>} />
          {message ? <InlineMessage kind={message.kind}>{message.text}</InlineMessage> : null}
        </div>
      </SettingsSection>

      <SettingsSection label="Password" lead="The shared caregiver password. Changing it does not sign this device out.">
        <div className="settings-card">
          <SettingsRow title="Change password" hint={`At least ${MIN_PASSWORD} characters.`} stacked>
            <div className="settings-fieldset">
              <SettingsField label="Current password">
                <input type="password" autoComplete="current-password" aria-label="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              </SettingsField>
              <SettingsField label="New password">
                <input type="password" autoComplete="new-password" aria-label="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              </SettingsField>
            </div>
            <div className="settings-actions">
              <button type="button" className="primary" onClick={submitPassword} disabled={pending || !newPassword}>{pending ? 'Updating…' : 'Update password'}</button>
            </div>
            {message ? <InlineMessage kind={message.kind}>{message.text}</InlineMessage> : null}
          </SettingsRow>
        </div>
      </SettingsSection>

      {onLogout ? (
        <SettingsSection label="Session">
          <div className="settings-card">
            <SettingsRow
              title="Sign out"
              hint="Ends this session on this device. Everything you have logged stays on the server."
              control={<button type="button" className="secondary" onClick={onLogout}>Sign out</button>}
            />
          </div>
        </SettingsSection>
      ) : null}
    </>
  )
}
