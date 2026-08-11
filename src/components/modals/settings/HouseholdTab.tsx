import { useEffect, useState } from 'react'
import { Copy, Users } from 'lucide-react'
import { createHouseholdInvite, fetchHouseholdAccess, removeHouseholdMember, revokeHouseholdInvite, updateHouseholdMemberRole, type HouseholdInvite, type HouseholdMember } from '../../../household/accessApi'
import { ConfirmButton, InlineMessage, SettingsBadge, SettingsEmpty, SettingsField, SettingsRow, SettingsSection } from './SettingsPrimitives'

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', caregiver: 'Caregiver', viewer: 'Viewer' }
const ROLE_HINT: Record<string, string> = {
  owner: 'Full access, including who else can get in.',
  caregiver: 'Can log and edit everything.',
  viewer: 'Can look, but not change anything.',
}

export function HouseholdAccessSetting({ role, showToast }: { role?: string; showToast: (message: string) => void }) {
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

  // Arming lives in ConfirmButton now, so this just carries the removal out —
  // a second gate here would have made it a three-press action.
  const removeMember = async (member: HouseholdMember) => {
    const result = await removeHouseholdMember(member.userId)
    if (result.ok) {
      setMembers((current) => current.filter((item) => item.userId !== member.userId))
      showToast('Member removed')
    } else setMessage(result.error)
  }

  if (!role || role === 'viewer') return null

  const owner = members.find((member) => member.role === 'owner')
  const others = members.filter((member) => member.role !== 'owner')

  return (
    <>
      {canManage ? (
        <SettingsSection label="Invite someone" lead="They get their own sign-in. You choose what they can do.">
          <div className="settings-card">
            <SettingsRow title="New invite" hint="Send an email address or a mobile number." stacked>
              <div className="settings-fieldset">
                <SettingsField label="Email or mobile">
                  <input aria-label="Invite email or mobile" type="text" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="caregiver@example.com or (555) 123-4567" />
                </SettingsField>
                <SettingsField label="Role" hint={ROLE_HINT[inviteRole]}>
                  <span className="settings-select">
                    <select aria-label="Invite role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'caregiver' | 'viewer')}>
                      <option value="caregiver">Caregiver</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </span>
                </SettingsField>
              </div>
              <div className="settings-actions">
                <button type="button" className="primary" onClick={sendInvite} disabled={!email.trim()}>Send invite</button>
              </div>
              {lastToken ? (
                <div className="settings-token">
                  <span className="settings-token-label">Invite code</span>
                  <code>{lastToken}</code>
                  <button
                    type="button"
                    aria-label="Copy invite code"
                    onClick={() => { void navigator.clipboard?.writeText(lastToken).then(() => showToast('Invite code copied')).catch(() => showToast('Could not copy the code')) }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </div>
              ) : null}
              {message ? <InlineMessage kind="error">{message}</InlineMessage> : null}
            </SettingsRow>
          </div>
        </SettingsSection>
      ) : null}

      <SettingsSection label="People" lead={canManage ? undefined : 'Who currently has access to this household.'}>
        <div className="settings-card">
          {owner ? (
            <SettingsRow
              title={owner.email || owner.displayName || owner.userId}
              hint={ROLE_HINT.owner}
              control={<SettingsBadge tone="owner">Owner</SettingsBadge>}
            />
          ) : null}
          {others.map((member) => {
            const label = member.email || member.displayName || member.userId
            return (
              <SettingsRow
                key={member.userId}
                title={label}
                hint={ROLE_HINT[member.role] ?? member.role}
                control={canManage ? (
                  <>
                    <span className="settings-select">
                      <select aria-label={`Role for ${label}`} value={member.role} onChange={(event) => updateRole(member, event.target.value as 'caregiver' | 'viewer')}>
                        <option value="caregiver">Caregiver</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </span>
                    <ConfirmButton
                      label="Remove"
                      confirmLabel="Confirm"
                      ariaLabel={`Remove ${label}`}
                      onConfirm={() => { void removeMember(member) }}
                    />
                  </>
                ) : <SettingsBadge tone="muted">{ROLE_LABEL[member.role] ?? member.role}</SettingsBadge>}
              />
            )
          })}
          {others.length === 0 && owner ? (
            <SettingsRow title="Nobody else yet" hint={canManage ? 'Invite a caregiver above and they will appear here.' : 'You are the only person with access.'} />
          ) : null}
        </div>
      </SettingsSection>

      {invites.length > 0 ? (
        <SettingsSection label="Pending invites" lead="Not accepted yet. Revoke one if it was sent by mistake.">
          <div className="settings-card">
            {invites.map((invite) => (
              <SettingsRow
                key={invite.id}
                title={invite.email}
                hint={`Invited as ${(ROLE_LABEL[invite.role] ?? invite.role).toLowerCase()}`}
                control={canManage ? (
                  <ConfirmButton label="Revoke" confirmLabel="Confirm" ariaLabel={`Revoke invite for ${invite.email}`} onConfirm={() => { void revokeInvite(invite) }} />
                ) : <SettingsBadge tone="pending">Pending</SettingsBadge>}
              />
            ))}
          </div>
        </SettingsSection>
      ) : null}

      {members.length === 0 && invites.length === 0 && !canManage ? (
        <SettingsEmpty icon={Users} title="No household members yet" body="Nobody has been added to this household." />
      ) : null}
    </>
  )
}
