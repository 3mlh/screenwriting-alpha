// GET  /api/projects/[projectId]/scripts  — list scripts in project
// POST /api/projects/[projectId]/scripts  — create a script in project

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser, requireProjectRole } from '@/lib/auth/permissions'
import { listScripts, createScript } from '@/lib/data/scripts'
import { toApiError } from '@/lib/auth/errors'
import { z } from 'zod'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    await requireProjectRole(supabase, projectId, 'viewer')

    const scripts = await listScripts(supabase, projectId)
    return NextResponse.json(scripts)
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

const createScriptSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  format: z.enum(['feature', 'pilot', 'spec', 'short']).default('feature'),
})

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)
    await requireProjectRole(supabase, projectId, 'editor')

    const body = await request.json()
    const input = createScriptSchema.parse(body)

    const script = await createScript(supabase, user.id, {
      projectId,
      title: input.title,
      format: input.format,
      initialBlocks: [],
    })

    return NextResponse.json(script, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
