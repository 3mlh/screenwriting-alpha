// ── Snapshot helper ────────────────────────────────────────────────────────────
//
// createSnapshot() is the single entry-point for writing a script_snapshots row.
// All snapshot creation (manual, autosave, revision_open, revision_close) goes
// through this function so the logic is in one place.
//
// Returns the snapshot id and taken_at timestamp.

import type { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import type { Database } from '@/lib/supabase/database.types'
import type { Block } from '@/types/screenplay'

type AppSupabaseClient = SupabaseClient<Database>
type SnapshotTrigger = Database['public']['Tables']['script_snapshots']['Insert']['trigger_type']

export interface SnapshotResult {
  id: string
  takenAt: string
}

export async function createSnapshot(
  supabase: AppSupabaseClient,
  opts: {
    scriptId: string
    userId: string
    blocks: Block[]
    triggerType: NonNullable<SnapshotTrigger>
    label?: string
  }
): Promise<SnapshotResult> {
  const { scriptId, userId, blocks, triggerType, label } = opts
  const snapshotId = uuidv4()
  const takenAt = new Date().toISOString()

  const { error } = await supabase
    .from('script_snapshots')
    .insert({
      id: snapshotId,
      script_id: scriptId,
      taken_by: userId,
      taken_at: takenAt,
      blocks: blocks as unknown as Database['public']['Tables']['script_snapshots']['Insert']['blocks'],
      trigger_type: triggerType,
      ...(label ? { label } : {}),
    })

  if (error) throw error ?? new Error('Failed to create snapshot')
  return { id: snapshotId, takenAt }
}

// ── Last snapshot time ────────────────────────────────────────────────────────
//
// Returns the taken_at of the most recent snapshot for a script.
// Used by the autosave route to determine whether a new autosave snapshot
// is due (>30 minutes since last snapshot of any type).

export async function getLastSnapshotAt(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<Date | null> {
  const { data, error } = await supabase
    .from('script_snapshots')
    .select('taken_at')
    .eq('script_id', scriptId)
    .order('taken_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  const row = data as unknown as { taken_at: string }
  return new Date(row.taken_at)
}
