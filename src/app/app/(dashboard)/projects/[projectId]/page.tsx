// ── Project detail — script list ────────────────────────────────────────────────
//
// RSC — fetches project + scripts server-side.

import { notFound, redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/data/projects'
import { listScripts } from '@/lib/data/scripts'
import { getProjectRole } from '@/lib/auth/permissions'
import { ProjectDetailClient } from './ProjectDetailClient'

type Props = { params: Promise<{ projectId: string }> }

export async function generateMetadata({ params }: Props) {
  const { projectId } = await params
  const supabase = await getSupabaseServerClient()
  const project = await getProject(supabase, projectId)
  return { title: project ? `${project.title} — Writer's Room` : 'Project' }
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [project, scripts, role] = await Promise.all([
    getProject(supabase, projectId),
    listScripts(supabase, projectId),
    getProjectRole(supabase, projectId),
  ])

  if (!project || !role) notFound()

  return (
    <ProjectDetailClient
      project={project}
      scripts={scripts}
      userId={user.id}
      currentUserRole={role}
    />
  )
}
