// ── Scripts repository ────────────────────────────────────────────────────────
//
// All script DB access goes through here. Returns canonical domain types.
// The blocks column is JSONB in Postgres; we validate on read to ensure
// the data matches the Block[] schema before returning to callers.
//
// Note on type casts: @supabase/supabase-js v2.99 select inference doesn't
// fully resolve manually-typed Database schemas. We assert row types explicitly;
// the function return signatures enforce correctness externally.

import type { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import type { Database } from '@/lib/supabase/database.types'
import type { Script, Block } from '@/types/screenplay'
import { safeValidateBlocks } from '@/lib/validation/block.schema'

type AppSupabaseClient = SupabaseClient<Database>
type ScriptRow = Database['public']['Tables']['scripts']['Row']
type ScriptRowWithCount = ScriptRow & {
  script_members?: { count: number }[]
  project?: { project_members?: { count: number }[] } | null
}

// ── Row → domain type ─────────────────────────────────────────────────────────

function toScript(row: ScriptRowWithCount): Script {
  // Validate blocks from DB — if corrupted, return empty array rather than crash.
  const validation = safeValidateBlocks(row.blocks)
  const blocks: Block[] = validation.success ? validation.data : []

  const scriptRow = row as typeof row & { current_revision_set_id?: string | null }

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    blocks,
    currentRevisionSetId: scriptRow.current_revision_set_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by,
    memberCount: row.script_members?.[0]?.count ?? 0,
    projectMemberCount: row.project?.project_members?.[0]?.count ?? 1,
  }
}

// ── Script list item (no blocks — too heavy for list views) ───────────────────

export interface ScriptListItem {
  id: string
  projectId: string
  projectTitle?: string
  title: string
  createdAt: string
  updatedAt: string
  memberCount: number
}

type ScriptListRow = Pick<ScriptRow, 'id' | 'project_id' | 'title' | 'created_at' | 'updated_at'> & {
  script_members?: { count: number }[]
  project?: { title: string } | null
}

function toScriptListItem(row: ScriptListRow): ScriptListItem {
  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle: (row.project as { title?: string } | null)?.title,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount: row.script_members?.[0]?.count ?? 0,
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function listScripts(
  supabase: AppSupabaseClient,
  projectId: string
): Promise<ScriptListItem[]> {
  const { data, error } = await supabase
    .from('scripts')
    .select('id, project_id, title, created_at, updated_at, script_members(count)')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as ScriptListRow[]).map(toScriptListItem)
}

export async function getScript(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<Script | null> {
  const { data, error } = await supabase
    .from('scripts')
    .select('*, script_members(count), project:projects!inner(project_members(count))')
    .eq('id', scriptId)
    .single()

  if (error || !data) return null
  return toScript(data as unknown as ScriptRowWithCount)
}

// Lightweight: just returns the blocks column.
// Use this in the editor load path — avoid loading full Script metadata twice.
export async function getScriptBlocks(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<Block[] | null> {
  const { data, error } = await supabase
    .from('scripts')
    .select('blocks')
    .eq('id', scriptId)
    .single()

  if (error || !data) return null
  const row = data as unknown as Pick<ScriptRow, 'blocks'>
  const validation = safeValidateBlocks(row.blocks)
  return validation.success ? validation.data : []
}

// ── Writes ─────────────────────────────────────────────────────────────────────

export async function createScript(
  supabase: AppSupabaseClient,
  userId: string,
  input: {
    projectId: string
    title: string
    initialBlocks?: Block[]
  }
): Promise<Script> {
  const scriptId = uuidv4()

  const { error } = await supabase
    .from('scripts')
    .insert({
      id: scriptId,
      project_id: input.projectId,
      title: input.title.trim(),
      blocks: (input.initialBlocks ?? []) as unknown as Database['public']['Tables']['scripts']['Insert']['blocks'],
      created_by: userId,
    } as Database['public']['Tables']['scripts']['Insert'])

  if (error) throw error

  const script = await getScript(supabase, scriptId)
  if (!script) throw new Error('Failed to load created script')
  return script
}

export async function updateScriptMeta(
  supabase: AppSupabaseClient,
  scriptId: string,
  update: { title?: string }
): Promise<Script | null> {
  const { error } = await supabase
    .from('scripts')
    .update({
      ...(update.title !== undefined && { title: update.title.trim() }),
    } as Database['public']['Tables']['scripts']['Update'])
    .eq('id', scriptId)

  if (error) return null
  return getScript(supabase, scriptId)
}

export async function saveScriptBlocks(
  supabase: AppSupabaseClient,
  scriptId: string,
  blocks: Block[]
): Promise<{ updatedAt: string }> {
  const { error } = await supabase
    .from('scripts')
    .update({ blocks: blocks as unknown as Database['public']['Tables']['scripts']['Update']['blocks'] } as Database['public']['Tables']['scripts']['Update'])
    .eq('id', scriptId)

  if (error) throw error ?? new Error('Failed to save blocks')

  const { data, error: readError } = await supabase
    .from('scripts')
    .select('updated_at')
    .eq('id', scriptId)
    .single()

  if (readError || !data) throw readError ?? new Error('Failed to load updated script timestamp')
  const row = data as unknown as Pick<ScriptRow, 'updated_at'>
  return { updatedAt: row.updated_at }
}

export async function listAllScripts(
  supabase: AppSupabaseClient,
  limit = 10
): Promise<ScriptListItem[]> {
  const { data, error } = await supabase
    .from('scripts')
    .select('id, project_id, title, created_at, updated_at, script_members(count), project:projects(title)')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as unknown as ScriptListRow[]).map(toScriptListItem)
}

export async function deleteScript(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<void> {
  const { error } = await supabase
    .from('scripts')
    .delete()
    .eq('id', scriptId)

  if (error) throw error
}
