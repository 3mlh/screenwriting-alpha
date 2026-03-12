'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InviteWithContext } from '@/types/screenplay'
import { PermissionBadge } from '@/components/ui/PermissionBadge'

export function PendingInvites({ initialInvites }: { initialInvites: InviteWithContext[] }) {
  const [invites, setInvites] = useState(initialInvites)
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  if (invites.length === 0) return null

  async function respond(inviteId: string, action: 'accept' | 'decline') {
    setLoading(inviteId)
    try {
      await fetch(`/api/invites/${inviteId}/${action}`, { method: 'POST' })
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
      if (action === 'accept') router.refresh()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold text-gray-900 mb-5" style={{ fontFamily: 'Georgia, serif' }}>
        Pending Invites
      </h2>
      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden divide-y divide-stone-100">
        {invites.map((invite) => (
          <div key={invite.id} className="flex items-center justify-between px-5 py-4 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                <span className="font-semibold">{invite.invitedByName || 'Someone'}</span>
                {' '}invited you to{' '}
                <span className="italic">&ldquo;{invite.resourceTitle}&rdquo;</span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 capitalize">{invite.resourceType}</span>
                <span className="text-gray-300">·</span>
                <PermissionBadge role={invite.role} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => respond(invite.id, 'decline')}
                disabled={loading === invite.id}
                className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg text-gray-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Decline
              </button>
              <button
                onClick={() => respond(invite.id, 'accept')}
                disabled={loading === invite.id}
                className="text-xs px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                {loading === invite.id ? 'Accepting…' : 'Accept'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
