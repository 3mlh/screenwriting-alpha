// ── Invites repository ────────────────────────────────────────────────────────
//
// Manages the invites table: create, accept, decline, list.
// Accepting an invite creates the member row and marks the invite accepted.
// Access control enforced at the Route Handler layer before these are called.

import type { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import type { Database } from '@/lib/supabase/database.types'
import type { InviteWithContext, PermissionLevel } from '@/types/screenplay'
import { addProjectMember, addScriptMember } from './members'

type AppSupabaseClient = SupabaseClient<Database>

export class DuplicateInviteError extends Error {
  constructor() { super('A pending invite already exists for this user') }
}

export class AlreadyMemberError extends Error {
  constructor() { super('This user is already a member') }
}

// ── Row shape returned by the enriched query ──────────────────────────────────

type InviteRow = {
  id: string
  resource_type: 'project' | 'script'
  resource_id: string
  invited_user_id: string
  invited_by: string
  role: string
  status: string
  created_at: string
  inviter: { display_name: string } | null
}

function toInviteWithContext(
  row: InviteRow,
  resourceTitle: string
): InviteWithContext {
  return {
    id: row.id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    invitedUserId: row.invited_user_id,
    invitedBy: row.invited_by,
    invitedByName: row.inviter?.display_name ?? '',
    role: row.role as PermissionLevel,
    status: row.status as InviteWithContext['status'],
    createdAt: row.created_at,
    resourceTitle,
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

// Returns all pending invites for the current user, enriched with resource titles.
export async function listMyInvites(
  supabase: AppSupabaseClient,
  userId: string
): Promise<InviteWithContext[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*, inviter:invited_by(display_name)')
    .eq('invited_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return []

  const rows = data as unknown as InviteRow[]

  // Fetch resource titles in parallel.
  const projectIds = rows.filter(r => r.resource_type === 'project').map(r => r.resource_id)
  const scriptIds  = rows.filter(r => r.resource_type === 'script').map(r => r.resource_id)

  const [projectsRes, scriptsRes] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('projects').select('id, title').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
    scriptIds.length > 0
      ? supabase.from('scripts').select('id, title').in('id', scriptIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const titleMap = new Map<string, string>()
  for (const p of (projectsRes.data ?? [])) titleMap.set(p.id, p.title)
  for (const s of (scriptsRes.data ?? [])) titleMap.set(s.id, s.title)

  return rows.map(row => toInviteWithContext(row, titleMap.get(row.resource_id) ?? 'Unknown'))
}

// Returns pending invites for a specific resource (visible to the sender via RLS).
export async function listResourceInvites(
  supabase: AppSupabaseClient,
  resourceType: 'project' | 'script',
  resourceId: string
): Promise<{ id: string; invitedByName: string; role: PermissionLevel; createdAt: string; invitedUserId: string; displayName: string }[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('id, role, created_at, invited_user_id, invitee:invited_user_id(display_name)')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data) return []

  return (data as unknown as {
    id: string
    role: string
    created_at: string
    invited_user_id: string
    invitee: { display_name: string } | null
  }[]).map(row => ({
    id: row.id,
    invitedByName: '',
    role: row.role as PermissionLevel,
    createdAt: row.created_at,
    invitedUserId: row.invited_user_id,
    displayName: row.invitee?.display_name ?? 'Unknown',
  }))
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createInvite(
  supabase: AppSupabaseClient,
  params: {
    resourceType: 'project' | 'script'
    resourceId: string
    invitedUserId: string
    invitedBy: string
    role: PermissionLevel
  }
): Promise<{ id: string }> {
  const inviteId = uuidv4()

  // Guard: no duplicate pending invite.
  const { count } = await supabase
    .from('invites')
    .select('*', { count: 'exact', head: true })
    .eq('resource_type', params.resourceType)
    .eq('resource_id', params.resourceId)
    .eq('invited_user_id', params.invitedUserId)
    .eq('status', 'pending')

  if ((count ?? 0) > 0) throw new DuplicateInviteError()

  // Guard: not already a member.
  const memberTable = params.resourceType === 'project' ? 'project_members' : 'script_members'
  const idCol = params.resourceType === 'project' ? 'project_id' : 'script_id'
  const { count: memberCount } = await supabase
    .from(memberTable)
    .select('*', { count: 'exact', head: true })
    .eq(idCol, params.resourceId)
    .eq('user_id', params.invitedUserId)

  if ((memberCount ?? 0) > 0) throw new AlreadyMemberError()

  const { error } = await supabase
    .from('invites')
    .insert({
      id: inviteId,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      invited_user_id: params.invitedUserId,
      invited_by: params.invitedBy,
      role: params.role,
    })

  if (error) throw error ?? new Error('Failed to create invite')
  return { id: inviteId }
}

export async function acceptInvite(
  supabase: AppSupabaseClient,
  inviteId: string,
  userId: string
): Promise<void> {
  // Load the invite (RLS ensures only the recipient can see it).
  const { data: invite, error } = await supabase
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .eq('invited_user_id', userId)
    .eq('status', 'pending')
    .single()

  if (error || !invite) throw new Error('Invite not found or already processed')

  const row = invite as {
    resource_type: 'project' | 'script'
    resource_id: string
    invited_user_id: string
    invited_by: string
    role: string
  }

  // Create the membership (silently ignore if already a member).
  try {
    if (row.resource_type === 'project') {
      await addProjectMember(supabase, row.resource_id, row.invited_user_id, row.role as PermissionLevel, row.invited_by)
    } else {
      await addScriptMember(supabase, row.resource_id, row.invited_user_id, row.role as PermissionLevel, row.invited_by)
    }
  } catch {
    // Membership may already exist — still mark the invite accepted.
  }

  await supabase.from('invites').update({ status: 'accepted' }).eq('id', inviteId)
}

export async function declineInvite(
  supabase: AppSupabaseClient,
  inviteId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('invites')
    .update({ status: 'declined' })
    .eq('id', inviteId)
    .eq('invited_user_id', userId)
    .eq('status', 'pending')

  if (error) throw error
}
