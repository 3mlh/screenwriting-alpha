// PATCH  /api/projects/[projectId]/members/[userId]  — change role
// DELETE /api/projects/[projectId]/members/[userId]  — remove member

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireProjectRole } from '@/lib/auth/permissions'
import { updateProjectMember, removeProjectMember, LastOwnerError } from '@/lib/data/members'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ projectId: string; userId: string }> }

const patchSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']),
})

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { projectId, userId } = await params
    const supabase = await getSupabaseServerClient()
    await requireProjectRole(supabase, projectId, 'owner')

    const body = await request.json()
    const { role } = patchSchema.parse(body)

    await updateProjectMember(supabase, projectId, userId, role)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    if (err instanceof LastOwnerError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { projectId, userId } = await params
    const supabase = await getSupabaseServerClient()
    await requireProjectRole(supabase, projectId, 'owner')

    await removeProjectMember(supabase, projectId, userId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof LastOwnerError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
