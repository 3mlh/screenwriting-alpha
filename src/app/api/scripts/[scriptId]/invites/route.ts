// GET /api/scripts/[scriptId]/invites  — list pending invites for this script

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole } from '@/lib/auth/permissions'
import { listResourceInvites } from '@/lib/data/invites'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ scriptId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'owner')
    const invites = await listResourceInvites(supabase, 'script', scriptId)
    return NextResponse.json(invites)
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
