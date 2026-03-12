// GET /api/invites  — list pending invites for the current user

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/permissions'
import { listMyInvites } from '@/lib/data/invites'
import { toApiError } from '@/lib/auth/errors'

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)
    const invites = await listMyInvites(supabase, user.id)
    return NextResponse.json(invites)
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
