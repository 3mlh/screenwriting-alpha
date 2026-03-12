// ── Project detail — script list ────────────────────────────────────────────────
//
// RSC — fetches project + scripts server-side.

import { notFound } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getProject } from '@/lib/data/projects'
import { listScripts } from '@/lib/data/scripts'
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

  const [project, scripts] = await Promise.all([
    getProject(supabase, projectId),
    listScripts(supabase, projectId),
  ])

  if (!project) notFound()

  return <ProjectDetailClient project={project} scripts={scripts} />
}
