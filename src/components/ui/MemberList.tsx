'use client'

import { useState } from 'react'
import type { MemberProfile, PermissionLevel } from '@/types/screenplay'
import { PermissionBadge } from './PermissionBadge'

type Props = {
  members: MemberProfile[]
  currentUserId: string
  currentUserRole: PermissionLevel
  onChangeRole: (userId: string, role: PermissionLevel) => Promise<void>
  onRemove: (userId: string) => Promise<void>
}

const ROLES: PermissionLevel[] = ['owner', 'editor', 'viewer']

export function MemberList({ members, currentUserId, currentUserRole, onChangeRole, onRemove }: Props) {
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)
  const isOwner = currentUserRole === 'owner'

  async function handleRoleChange(userId: string, role: PermissionLevel) {
    setLoadingUserId(userId)
    try {
      await onChangeRole(userId, role)
    } finally {
      setLoadingUserId(null)
    }
  }

  async function handleRemove(userId: string) {
    setLoadingUserId(userId)
    try {
      await onRemove(userId)
    } finally {
      setLoadingUserId(null)
    }
  }

  return (
    <div className="divide-y divide-stone-100">
      {members.map((member) => {
        const isSelf = member.userId === currentUserId
        const isLoading = loadingUserId === member.userId
        const isInherited = member.accessVia === 'project'
        const canEdit = isOwner && !isSelf && !isInherited

        return (
          <div key={member.userId} className="flex items-center justify-between py-3 px-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-stone-600 uppercase">
                {member.displayName?.[0] ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {member.displayName || 'Unnamed'}
                  {isSelf && <span className="ml-1.5 text-xs text-gray-400 font-normal">(you)</span>}
                </p>
                {isInherited && (
                  <p className="text-[11px] text-gray-400">via project</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit ? (
                <select
                  value={member.role}
                  disabled={isLoading}
                  onChange={(e) => handleRoleChange(member.userId, e.target.value as PermissionLevel)}
                  className="text-xs border border-stone-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-600 disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              ) : (
                <PermissionBadge role={member.role} />
              )}

              {canEdit && (
                <button
                  onClick={() => handleRemove(member.userId)}
                  disabled={isLoading}
                  className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40 p-1"
                  title="Remove member"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
