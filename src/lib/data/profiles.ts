// ── Profile repository ────────────────────────────────────────────────────────
//
// Thin wrapper over the profiles table. Returns plain domain objects.
// All Supabase specifics stay in this file.
//
// Note on type casts: @supabase/supabase-js v2.99 select inference doesn't
// fully resolve manually-typed Database schemas. We assert row types explicitly;
// the function return signatures enforce correctness externally.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type AppSupabaseClient = SupabaseClient<Database>
type ProfileRow = Database['public']['Tables']['profiles']['Row']

export interface UserProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
}

function toProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function getProfile(
  supabase: AppSupabaseClient,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return toProfile(data as unknown as ProfileRow)
}

// ── Writes ─────────────────────────────────────────────────────────────────────

export async function updateProfile(
  supabase: AppSupabaseClient,
  userId: string,
  update: { displayName?: string; avatarUrl?: string }
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...(update.displayName !== undefined && { display_name: update.displayName }),
      ...(update.avatarUrl !== undefined && { avatar_url: update.avatarUrl }),
    } as Database['public']['Tables']['profiles']['Update'])
    .eq('id', userId)
    .select()
    .single()

  if (error || !data) return null
  return toProfile(data as unknown as ProfileRow)
}
