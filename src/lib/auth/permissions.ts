// ── Permission guards ─────────────────────────────────────────────────────────
//
// Called at the top of every mutating Route Handler BEFORE any DB write.
// These are the app-layer authorization checks — they complement RLS (which is
// the security guarantee) with explicit business-logic enforcement.
//
// M2 enforces owner-only access (created_by = user.id).
// M3 will expand these to check project_members / script_members tables and
// the effective_script_role() DB function for shared access.
//
// What is enforced by RLS:
//   - owner can SELECT/INSERT/UPDATE/DELETE their own projects and scripts
//   - all other rows are invisible
//
// What is enforced here (app layer):
//   - explicit auth check before every write (defense in depth)
//   - foundation for future role-based checks (editor/viewer distinctions)
//
// What is deferred to M3:
//   - member table lookups
//   - effective role computation (script-level overrides project-level)
//   - invite workflows

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { PermissionLevel } from '@/types/screenplay'
import { UnauthorizedError, ForbiddenError } from './errors'

type AppSupabaseClient = SupabaseClient<Database>

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

  const { data: project, error } = await supabase
    .from('projects')
    .select('created_by')
    .eq('id', projectId)
    .single()

  if (error || !project) {
    // Either the row doesn't exist or RLS hides it — same response either way.
    throw new ForbiddenError()
  }

  // M2: owner-only. M3 will check project_members for editor/viewer roles.
  if (minimum === 'owner' || minimum === 'editor' || minimum === 'viewer') {
    if (project.created_by !== user.id) throw new ForbiddenError()
  }
}

// ── Script guards ─────────────────────────────────────────────────────────────

export async function requireScriptRole(
  supabase: AppSupabaseClient,
  scriptId: string,
  minimum: PermissionLevel
): Promise<void> {
  const user = await requireUser(supabase)

  const { data: script, error } = await supabase
    .from('scripts')
    .select('created_by')
    .eq('id', scriptId)
    .single()

  if (error || !script) {
    throw new ForbiddenError()
  }

  // M2: owner-only. M3 will add effective_script_role() lookup for shared access.
  if (minimum === 'owner' || minimum === 'editor' || minimum === 'viewer') {
    if (script.created_by !== user.id) throw new ForbiddenError()
  }
}
