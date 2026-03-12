// ── Permission guards ─────────────────────────────────────────────────────────
//
// Called at the top of every mutating Route Handler BEFORE any DB write.
// These complement RLS (the security guarantee) with explicit app-layer checks.
//
// Role hierarchy: owner > editor > viewer
//
// Project access: determined by project_members row (owner auto-inserted on creation).
// Script access:  effective_script_role() — script-level overrides project-level.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { PermissionLevel } from '@/types/screenplay'
import { UnauthorizedError, ForbiddenError } from './errors'

type AppSupabaseClient = SupabaseClient<Database>

const ROLE_RANK: Record<PermissionLevel, number> = { owner: 3, editor: 2, viewer: 1 }

function meetsMinimum(actual: PermissionLevel, required: PermissionLevel): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required]
}

// ── Current user ──────────────────────────────────────────────────────────────

export async function requireUser(supabase: AppSupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new UnauthorizedError()
  return user
}

// ── Project guards ────────────────────────────────────────────────────────────

export async function requireProjectRole(
  supabase: AppSupabaseClient,
  projectId: string,
  minimum: PermissionLevel
): Promise<void> {
  const user = await requireUser(supabase)
  const { data: role, error } = await supabase.rpc('project_role', {
    p_project_id: projectId,
    p_user_id: user.id,
  })
  if (error || !role) throw new ForbiddenError()
  if (!meetsMinimum(role as PermissionLevel, minimum)) throw new ForbiddenError()
}

// Returns the role without throwing — used to conditionally show UI.
export async function getProjectRole(
  supabase: AppSupabaseClient,
  projectId: string
): Promise<PermissionLevel | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.rpc('project_role', {
    p_project_id: projectId,
    p_user_id: user.id,
  })
  return (data as PermissionLevel) ?? null
}

// ── Script guards ─────────────────────────────────────────────────────────────

export async function requireScriptRole(
  supabase: AppSupabaseClient,
  scriptId: string,
  minimum: PermissionLevel
): Promise<void> {
  const user = await requireUser(supabase)
  const { data: role, error } = await supabase.rpc('effective_script_role', {
    p_script_id: scriptId,
    p_user_id: user.id,
  })
  if (error || !role) throw new ForbiddenError()
  if (!meetsMinimum(role as PermissionLevel, minimum)) throw new ForbiddenError()
}

// Returns effective role without throwing — used by the script page RSC to
// set readOnly={role === 'viewer'} on the editor.
export async function getEffectiveScriptRole(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<PermissionLevel | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.rpc('effective_script_role', {
    p_script_id: scriptId,
    p_user_id: user.id,
  })
  return (data as PermissionLevel) ?? null
}
