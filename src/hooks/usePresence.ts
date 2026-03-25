'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type PresenceUser = {
  userId: string
  displayName: string
  color: string
  cursor: { blockId: string; offset: number } | null
}

// Deterministic color from userId
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899']
export function userColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash << 5) - hash + userId.charCodeAt(i)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function usePresence(
  scriptId: string,
  currentUser: { userId: string; displayName: string }
) {
  const selfPresence: PresenceUser = {
    userId: currentUser.userId,
    displayName: currentUser.displayName,
    color: userColor(currentUser.userId),
    cursor: null,
  }

  const [presences, setPresences] = useState<PresenceUser[]>([selfPresence])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const myPresenceRef = useRef<PresenceUser>(selfPresence)

  // Keep displayName in sync if it changes
  myPresenceRef.current = { ...myPresenceRef.current, displayName: currentUser.displayName }

  const broadcastCursor = useCallback((cursor: { blockId: string; offset: number } | null) => {
    myPresenceRef.current = { ...myPresenceRef.current, cursor }
    channelRef.current?.track(myPresenceRef.current)
  }, [])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const channel = supabase.channel(`presence:script:${scriptId}`, {
      config: { presence: { key: currentUser.userId } },
    })

    function syncState() {
      const state = channel.presenceState<PresenceUser>()
      const usersById = new Map<string, PresenceUser>()

      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          usersById.set(entry.userId, entry)
        }
      }

      const users = Array.from(usersById.values())
      // Always include self even while presence is syncing
      if (!users.some((u) => u.userId === currentUser.userId)) {
        users.unshift(myPresenceRef.current)
      }
      setPresences(users)
    }

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, syncState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(myPresenceRef.current)
        }
      })

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [scriptId, currentUser.userId])

  return { presences, broadcastCursor }
}
