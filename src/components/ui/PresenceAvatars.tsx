'use client'

import type { PresenceUser } from '@/hooks/usePresence'

type Props = {
  presences: PresenceUser[]
  currentUserId: string
}

export function PresenceAvatars({ presences, currentUserId }: Props) {
  if (presences.length === 0) return null

  const visible = presences.slice(0, 5)
  const overflow = presences.length - 5

  return (
    <div className="flex items-center">
      {visible.map((user, i) => (
        <div
          key={user.userId}
          title={user.userId === currentUserId ? `${user.displayName} (you)` : user.displayName}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0 ring-2 ring-white cursor-default select-none"
          style={{
            backgroundColor: user.color,
            marginLeft: i > 0 ? '-5px' : 0,
            zIndex: visible.length - i,
            position: 'relative',
          }}
        >
          {(user.displayName?.trim() || user.userId)[0].toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[10px] font-semibold text-gray-700 flex-shrink-0 ring-2 ring-white"
          style={{ marginLeft: '-5px', position: 'relative' }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
