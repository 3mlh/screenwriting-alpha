'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog } from './Dialog'
import { MemberList } from './MemberList'
import { PermissionBadge } from './PermissionBadge'
import type { MemberProfile, PermissionLevel } from '@/types/screenplay'

type ResourceType = 'project' | 'script'

type PendingInvite = {
  id: string
  displayName: string
  role: PermissionLevel
  createdAt: string
}

type Props = {
  open: boolean
  onClose: () => void
  resourceType: ResourceType
  resourceId: string
  currentUserId: string
  currentUserRole: PermissionLevel
}

type Tab = 'invite' | 'members'

export function ShareDialog({ open, onClose, resourceType, resourceId, currentUserId, currentUserRole }: Props) {
  const [tab, setTab] = useState<Tab>('invite')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const basePath = resourceType === 'project'
    ? `/api/projects/${resourceId}`
    : `/api/scripts/${resourceId}`

  const fetchData = useCallback(async () => {
    const [membersRes, invitesRes] = await Promise.all([
      fetch(`${basePath}/members`),
      fetch(`${basePath}/invites`),
    ])
    if (membersRes.ok) setMembers(await membersRes.json())
    if (invitesRes.ok) setPendingInvites(await invitesRes.json())
  }, [basePath])

  useEffect(() => {
    if (open) {
      fetchData()
      setError(null)
      setSuccess(null)
      setEmail('')
    }
  }, [open, fetchData])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${basePath}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invite')
      } else {
        setSuccess(`Invite sent to ${email}`)
        setEmail('')
        setTab('members')
        fetchData()
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setInviting(false)
    }
  }

  async function handleCancelInvite(inviteId: string) {
    const res = await fetch(`/api/invites/${inviteId}`, { method: 'DELETE' })
    if (res.ok) {
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
    }
  }

  async function handleChangeRole(userId: string, newRole: PermissionLevel) {
    const res = await fetch(`${basePath}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role: newRole } : m))
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to update role')
    }
  }

  async function handleRemove(userId: string) {
    const res = await fetch(`${basePath}/members/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to remove member')
    }
  }

  const isOwner = currentUserRole === 'owner'

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="bg-white rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-gray-900">Share {resourceType}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        {isOwner && (
          <div className="flex border-b border-stone-100 px-5">
            {(['invite', 'members'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); setSuccess(null) }}
                className={`text-sm py-2.5 mr-5 border-b-2 transition-colors capitalize ${
                  tab === t
                    ? 'border-amber-700 text-amber-800 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'invite'
                  ? 'Invite'
                  : `Members (${members.length}${pendingInvites.length > 0 ? ` · ${pendingInvites.length} pending` : ''})`}
              </button>
            ))}
          </div>
        )}

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {/* Error / success banners */}
          {error && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="mb-3 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{success}</p>
          )}

          {/* Invite tab */}
          {(tab === 'invite' && isOwner) && (
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  <option value="editor">Editor — can read and write</option>
                  <option value="viewer">Viewer — read only</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="w-full py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                {inviting ? 'Sending invite…' : 'Send invite'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                They&apos;ll receive an email and can accept from their dashboard.
              </p>
            </form>
          )}

          {/* Members tab (or viewer sees only this) */}
          {(tab === 'members' || !isOwner) && (
            <div className="space-y-5">
              {/* Active members */}
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No members yet.</p>
              ) : (
                <MemberList
                  members={members}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onChangeRole={handleChangeRole}
                  onRemove={handleRemove}
                />
              )}

              {/* Pending invites */}
              {isOwner && pendingInvites.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Pending invites
                  </p>
                  <div className="divide-y divide-stone-100">
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between py-3 px-1">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-stone-400 uppercase">
                            {invite.displayName?.[0] ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-700 truncate">{invite.displayName}</p>
                            <p className="text-[11px] text-gray-400">Invite pending</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <PermissionBadge role={invite.role} />
                          <button
                            onClick={() => handleCancelInvite(invite.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Cancel invite"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
