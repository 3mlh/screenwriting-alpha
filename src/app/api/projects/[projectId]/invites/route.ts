// GET /api/projects/[projectId]/invites  — list pending invites for this project

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireProjectRole } from '@/lib/auth/permissions'
import { listResourceInvites } from '@/lib/data/invites'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    await requireProjectRole(supabase, projectId, 'owner')
    const invites = await listResourceInvites(supabase, 'project', projectId)
    return NextResponse.json(invites)
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
