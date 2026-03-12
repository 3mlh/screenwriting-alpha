// DELETE /api/invites/[inviteId]  — cancel (sender revokes a pending invite)

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/permissions'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ inviteId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { inviteId } = await params
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)

    // RLS policy "invites: sender can delete" enforces that only invited_by can delete
    const { error } = await supabase
      .from('invites')
      .delete()
      .eq('id', inviteId)
      .eq('invited_by', user.id)
      .eq('status', 'pending')

    if (error) throw error
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
