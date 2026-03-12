// POST /api/invites/[inviteId]/decline

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/permissions'
import { declineInvite } from '@/lib/data/invites'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ inviteId: string }> }

export async function POST(_req: Request, { params }: Params) {
  try {
    const { inviteId } = await params
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)
    await declineInvite(supabase, inviteId, user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
