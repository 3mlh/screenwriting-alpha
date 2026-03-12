// GET    /api/projects/[projectId]  — get project
// PATCH  /api/projects/[projectId]  — update title/description (owner)
// DELETE /api/projects/[projectId]  — delete project (owner)

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireProjectRole } from '@/lib/auth/permissions'
import { getProject, updateProject, deleteProject } from '@/lib/data/projects'
import { toApiError, NotFoundError } from '@/lib/auth/errors'
import { z } from 'zod'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    await requireProjectRole(supabase, projectId, 'viewer')

    const project = await getProject(supabase, projectId)
    if (!project) throw new NotFoundError('Project')
    return NextResponse.json(project)
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    await requireProjectRole(supabase, projectId, 'owner')

    const body = await request.json()
    const update = patchSchema.parse(body)

    const project = await updateProject(supabase, projectId, update)
    if (!project) throw new NotFoundError('Project')
    return NextResponse.json(project)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    await requireProjectRole(supabase, projectId, 'owner')
    await deleteProject(supabase, projectId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
