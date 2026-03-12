// ── Members repository ────────────────────────────────────────────────────────
//
// Manages project_members and script_members rows.
// All writes are guarded at the Route Handler layer (requireProjectRole / requireScriptRole).
// The "last owner" guard lives here so it's enforced regardless of call site.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { MemberProfile, PermissionLevel } from '@/types/screenplay'

type AppSupabaseClient = SupabaseClient<Database>

// ── Shared ────────────────────────────────────────────────────────────────────

export class LastOwnerError extends Error {
  constructor() { super('Cannot remove or demote the last owner') }
}

// ── Project members ───────────────────────────────────────────────────────────

type ProjectMemberRow = {
  user_id: string
  role: string
  added_at: string
  profile: { display_name: string; avatar_url: string | null } | null
}

function toMemberProfile(row: ProjectMemberRow): MemberProfile {
  return {
    userId: row.user_id,
    displayName: row.profile?.display_name ?? '',
    avatarUrl: row.profile?.avatar_url,
    role: row.role as PermissionLevel,
    addedAt: row.added_at,
  }
}

export async function listProjectMembers(
  supabase: AppSupabaseClient,
  projectId: string
): Promise<MemberProfile[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('user_id, role, added_at, profile:profiles!user_id(display_name, avatar_url)')
    .eq('project_id', projectId)
    .order('added_at')

  if (error) throw error
  return ((data ?? []) as unknown as ProjectMemberRow[]).map(toMemberProfile)
}

export async function addProjectMember(
  supabase: AppSupabaseClient,
  projectId: string,
  userId: string,
  role: PermissionLevel,
  invitedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role, invited_by: invitedBy })

  if (error) throw error
}

export async function updateProjectMember(
  supabase: AppSupabaseClient,
  projectId: string,
  userId: string,
  role: PermissionLevel
): Promise<void> {
  if (role !== 'owner') {
    await assertNotLastOwner(supabase, 'project', projectId, userId)
  }
  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function removeProjectMember(
  supabase: AppSupabaseClient,
  projectId: string,
  userId: string
): Promise<void> {
  await assertNotLastOwner(supabase, 'project', projectId, userId)

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw error
}

// ── Script members ────────────────────────────────────────────────────────────

type ScriptMemberRow = {
  user_id: string
  role: string
  added_at: string
  profile: { display_name: string; avatar_url: string | null } | null
}

export async function listScriptMembers(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<MemberProfile[]> {
  const { data, error } = await supabase
    .from('script_members')
    .select('user_id, role, added_at, profile:profiles!user_id(display_name, avatar_url)')
    .eq('script_id', scriptId)
    .order('added_at')

  if (error) throw error
  return ((data ?? []) as unknown as ScriptMemberRow[]).map(toMemberProfile)
}

export async function addScriptMember(
  supabase: AppSupabaseClient,
  scriptId: string,
  userId: string,
  role: PermissionLevel,
  invitedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('script_members')
    .insert({ script_id: scriptId, user_id: userId, role, invited_by: invitedBy })

  if (error) throw error
}

export async function updateScriptMember(
  supabase: AppSupabaseClient,
  scriptId: string,
  userId: string,
  role: PermissionLevel
): Promise<void> {
  if (role !== 'owner') {
    await assertNotLastOwner(supabase, 'script', scriptId, userId)
  }
  const { error } = await supabase
    .from('script_members')
    .update({ role })
    .eq('script_id', scriptId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function removeScriptMember(
  supabase: AppSupabaseClient,
  scriptId: string,
  userId: string
): Promise<void> {
  await assertNotLastOwner(supabase, 'script', scriptId, userId)

  const { error } = await supabase
    .from('script_members')
    .delete()
    .eq('script_id', scriptId)
    .eq('user_id', userId)

  if (error) throw error
}

// ── All script viewers (direct + inherited via project) ───────────────────────
//
// Returns script-level members first (accessVia: 'direct'), then project members
// who don't already appear as direct script members (accessVia: 'project').

export async function listAllScriptViewers(
  supabase: AppSupabaseClient,
  scriptId: string
): Promise<MemberProfile[]> {
  const { data: scriptRow } = await supabase
    .from('scripts')
    .select('project_id')
    .eq('id', scriptId)
    .single()

  if (!scriptRow) return []
  const projectId = (scriptRow as { project_id: string }).project_id

  const [scriptMembers, projectMembers] = await Promise.all([
    listScriptMembers(supabase, scriptId),
    listProjectMembers(supabase, projectId),
  ])

  const directIds = new Set(scriptMembers.map((m) => m.userId))
  const inherited = projectMembers
    .filter((m) => !directIds.has(m.userId))
    .map((m) => ({ ...m, accessVia: 'project' as const }))

  return [
    ...scriptMembers.map((m) => ({ ...m, accessVia: 'direct' as const })),
    ...inherited,
  ]
}

// ── User lookup ───────────────────────────────────────────────────────────────

export async function lookupUserByEmail(
  supabase: AppSupabaseClient,
  email: string
): Promise<{ userId: string; displayName: string } | null> {
  const { data, error } = await supabase.rpc('lookup_user_by_email', { p_email: email })
  if (error || !data || data.length === 0) return null
  const row = data[0]
  return { userId: row.user_id, displayName: row.display_name }
}

// ── Last-owner guard ──────────────────────────────────────────────────────────

async function assertNotLastOwner(
  supabase: AppSupabaseClient,
  resource: 'project' | 'script',
  resourceId: string,
  userId: string
): Promise<void> {
  const table = resource === 'project' ? 'project_members' : 'script_members'
  const idCol = resource === 'project' ? 'project_id' : 'script_id'

  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(idCol, resourceId)
    .eq('role', 'owner')

  // If there's only one owner and it's this user, block the operation.
  if ((count ?? 0) <= 1) {
    const { data } = await supabase
      .from(table)
      .select('user_id')
      .eq(idCol, resourceId)
      .eq('role', 'owner')
      .single()

    if (data && (data as { user_id: string }).user_id === userId) {
      throw new LastOwnerError()
    }
  }
}
