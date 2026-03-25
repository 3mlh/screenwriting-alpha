// ── Projects repository ───────────────────────────────────────────────────────
//
// All project DB access goes through here. Returns canonical domain types.
// Callers (Route Handlers, Server Components) never import from @supabase directly.
//
// Note on type casts: @supabase/supabase-js v2.99 select inference doesn't
// fully resolve manually-typed Database schemas. We assert row types explicitly;
// the function return signatures enforce correctness externally.

import type { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import type { Database } from '@/lib/supabase/database.types'
import type { Project } from '@/types/screenplay'

type AppSupabaseClient = SupabaseClient<Database>
type ProjectRow = Database['public']['Tables']['projects']['Row']

type ProjectWithCount = ProjectRow & {
  project_members?: { count: number }[]
  scripts?: { count: number }[]
}

function toProject(row: ProjectWithCount): Project {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    createdByUserId: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount: row.project_members?.[0]?.count ?? 1,
    scriptCount: row.scripts?.[0]?.count ?? 0,
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────────

export async function listProjects(supabase: AppSupabaseClient): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_members(count), scripts(count)')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as ProjectWithCount[]).map(toProject)
}

export async function getProject(
  supabase: AppSupabaseClient,
  projectId: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_members(count), scripts(count)')
    .eq('id', projectId)
    .single()

  if (error || !data) return null
  return toProject(data as unknown as ProjectWithCount)
}

// ── Writes ─────────────────────────────────────────────────────────────────────

export async function createProject(
  supabase: AppSupabaseClient,
  userId: string,
  input: { title: string; description?: string }
): Promise<Project> {
  const projectId = uuidv4()

  const { error } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      created_by: userId,
    } as Database['public']['Tables']['projects']['Insert'])

  if (error) throw error

  const project = await getProject(supabase, projectId)
  if (!project) throw new Error('Failed to load created project')
  return project
}

export async function updateProject(
  supabase: AppSupabaseClient,
  projectId: string,
  update: { title?: string; description?: string }
): Promise<Project | null> {
  const { error } = await supabase
    .from('projects')
    .update({
      ...(update.title !== undefined && { title: update.title.trim() }),
      ...(update.description !== undefined && { description: update.description.trim() || null }),
    } as Database['public']['Tables']['projects']['Update'])
    .eq('id', projectId)

  if (error) return null
  return getProject(supabase, projectId)
}

export async function listSharedProjects(
  supabase: AppSupabaseClient,
  userId: string
): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_members(count), scripts(count)')
    .neq('created_by', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as unknown as ProjectWithCount[]).map(toProject)
}

export async function deleteProject(
  supabase: AppSupabaseClient,
  projectId: string
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) throw error
}
