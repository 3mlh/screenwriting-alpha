// ── Revisions data layer ───────────────────────────────────────────────────────
//
// CRUD for script_snapshots and revision_sets.
// All functions take an authenticated SupabaseClient — callers are responsible
// for permission checks (requireScriptRole) before calling these.

import type { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import type { Database } from '@/lib/supabase/database.types'
import type { Block, ScriptSnapshot, RevisionSet } from '@/types/screenplay'
import { safeValidateBlocks } from '@/lib/validation/block.schema'

type AppSupabaseClient = SupabaseClient<Database>
type SnapshotRow = Database['public']['Tables']['script_snapshots']['Row']
type RevisionSetRow = Database['public']['Tables']['revision_sets']['Row']

// ── Row → domain mappers ──────────────────────────────────────────────────────

function toSnapshot(row: SnapshotRow): ScriptSnapshot {
  const validation = safeValidateBlocks(row.blocks)
  return {
    id: row.id,
    scriptId: row.script_id,
    blocks: validation.success ? validation.data : [],
    takenAt: row.taken_at,
    takenByUserId: row.taken_by,
    label: row.label ?? undefined,
    triggerType: row.trigger_type as ScriptSnapshot['triggerType'],
  }
}

function toRevisionSet(row: RevisionSetRow): RevisionSet {
  return {
    id: row.id,
    scriptId: row.script_id,
    name: row.name,
    color: row.color,
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
    openSnapshotId: row.open_snapshot_id,
    closeSnapshotId: row.close_snapshot_id ?? undefined,
    createdByUserId: row.created_by,
    isActive: row.is_active,
  }
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

// List snapshot metadata (no blocks) — for the history sidebar
export async function listSnapshots(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<Omit<ScriptSnapshot, 'blocks'>[]> {
  const { data, error } = await supabase
    .from('script_snapshots')
    .select('id, script_id, taken_by, taken_at, label, trigger_type')
    .eq('script_id', scriptId)
    .in('trigger_type', ['manual', 'revision_open', 'revision_close'])
    .order('taken_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as SnapshotRow[]).map((row) => ({
    id: row.id,
    scriptId: row.script_id,
    blocks: [], // not loaded in list view
    takenAt: row.taken_at,
    takenByUserId: row.taken_by,
    label: row.label ?? undefined,
    triggerType: row.trigger_type as ScriptSnapshot['triggerType'],
  }))
}

// Get a single snapshot with full blocks
export async function getSnapshot(
  supabase: AppSupabaseClient,
  snapshotId: string
): Promise<ScriptSnapshot | null> {
  const { data, error } = await supabase
    .from('script_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single()

  if (error || !data) return null
  return toSnapshot(data as unknown as SnapshotRow)
}

// ── Revision sets ─────────────────────────────────────────────────────────────

export async function listRevisionSets(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<RevisionSet[]> {
  const { data, error } = await supabase
    .from('revision_sets')
    .select('*')
    .eq('script_id', scriptId)
    .order('opened_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as RevisionSetRow[]).map(toRevisionSet)
}

export async function getRevisionSet(
  supabase: AppSupabaseClient,
  revisionSetId: string
): Promise<RevisionSet | null> {
  const { data, error } = await supabase
    .from('revision_sets')
    .select('*')
    .eq('id', revisionSetId)
    .single()

  if (error || !data) return null
  return toRevisionSet(data as unknown as RevisionSetRow)
}

export async function createRevisionSet(
  supabase: AppSupabaseClient,
  opts: {
    scriptId: string
    userId: string
    name: string
    color: string
    openSnapshotId: string
  }
): Promise<RevisionSet> {
  const revisionSetId = uuidv4()

  const { error } = await supabase
    .from('revision_sets')
    .insert({
      id: revisionSetId,
      script_id: opts.scriptId,
      name: opts.name,
      color: opts.color,
      open_snapshot_id: opts.openSnapshotId,
      created_by: opts.userId,
      is_active: true,
    })

  if (error) throw error ?? new Error('Failed to create revision set')
  const revisionSet = await getRevisionSet(supabase, revisionSetId)
  if (!revisionSet) throw new Error('Failed to load created revision set')
  return revisionSet
}

export async function closeRevisionSet(
  supabase: AppSupabaseClient,
  revisionSetId: string,
  closeSnapshotId: string
): Promise<RevisionSet> {
  const { error } = await supabase
    .from('revision_sets')
    .update({
      close_snapshot_id: closeSnapshotId,
      closed_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('id', revisionSetId)

  if (error) throw error ?? new Error('Failed to close revision set')
  const revisionSet = await getRevisionSet(supabase, revisionSetId)
  if (!revisionSet) throw new Error('Failed to load closed revision set')
  return revisionSet
}

export async function updateRevisionSetMeta(
  supabase: AppSupabaseClient,
  revisionSetId: string,
  update: { name?: string; color?: string }
): Promise<RevisionSet> {
  const { error } = await supabase
    .from('revision_sets')
    .update(update)
    .eq('id', revisionSetId)

  if (error) throw error ?? new Error('Failed to update revision set')
  const revisionSet = await getRevisionSet(supabase, revisionSetId)
  if (!revisionSet) throw new Error('Failed to load updated revision set')
  return revisionSet
}

// ── Active revision lookup ────────────────────────────────────────────────────
//
// Reads scripts.current_revision_set_id without loading a full Script object.

export async function getActiveRevisionSetId(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('scripts')
    .select('current_revision_set_id')
    .eq('id', scriptId)
    .single()

  if (error || !data) return null
  const row = data as unknown as { current_revision_set_id: string | null }
  return row.current_revision_set_id
}

export async function setCurrentRevisionSet(
  supabase: AppSupabaseClient,
  scriptId: string,
  revisionSetId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('scripts')
    .update({ current_revision_set_id: revisionSetId })
    .eq('id', scriptId)

  if (error) throw error
}

// ── Restore ───────────────────────────────────────────────────────────────────
//
// Restores a script's blocks to the given snapshot's block array.
// The caller is responsible for creating a pre-restore backup snapshot first.

export async function restoreScriptToSnapshot(
  supabase: AppSupabaseClient,
  scriptId: string,
  blocks: Block[]
): Promise<void> {
  const { error } = await supabase
    .from('scripts')
    .update({
      blocks: blocks as unknown as Database['public']['Tables']['scripts']['Update']['blocks'],
    })
    .eq('id', scriptId)

  if (error) throw error
}
