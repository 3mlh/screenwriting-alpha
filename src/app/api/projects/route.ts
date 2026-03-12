// GET  /api/projects  — list current user's projects
// POST /api/projects  — create a project

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/permissions'
import { listProjects, createProject } from '@/lib/data/projects'
import { toApiError } from '@/lib/auth/errors'
import { z } from 'zod'

const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
})

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()
    await requireUser(supabase)
    const projects = await listProjects(supabase)
    return NextResponse.json(projects)
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)

    const body = await request.json()
    const input = createProjectSchema.parse(body)

    const project = await createProject(supabase, user.id, input)
    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
