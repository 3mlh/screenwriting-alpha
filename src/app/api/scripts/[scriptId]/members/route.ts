// GET  /api/scripts/[scriptId]/members  — list members
// POST /api/scripts/[scriptId]/members  — invite by email

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser, requireScriptRole } from '@/lib/auth/permissions'
import { listAllScriptViewers, lookupUserByEmail } from '@/lib/data/members'
import { createInvite, DuplicateInviteError, AlreadyMemberError } from '@/lib/data/invites'
import { sendInviteEmail } from '@/lib/email/sendInvite'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ scriptId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'viewer')

    const members = await listAllScriptViewers(supabase, scriptId)
    return NextResponse.json(members)
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']),
})

export async function POST(request: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)
    await requireScriptRole(supabase, scriptId, 'owner')

    const body = await request.json()
    const { email, role } = inviteSchema.parse(body)

    const target = await lookupUserByEmail(supabase, email)
    if (!target) {
      return NextResponse.json({ error: 'No account found for that email address' }, { status: 404 })
    }

    const { id: inviteId } = await createInvite(supabase, {
      resourceType: 'script',
      resourceId: scriptId,
      invitedUserId: target.userId,
      invitedBy: user.id,
      role,
    })

    const { data: script } = await supabase
      .from('scripts')
      .select('title')
      .eq('id', scriptId)
      .single()

    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    await sendInviteEmail({
      toEmail: email,
      inviterName: (inviterProfile as { display_name: string } | null)?.display_name ?? 'A collaborator',
      resourceType: 'script',
      resourceTitle: (script as { title: string } | null)?.title ?? 'a script',
      role,
    })

    return NextResponse.json({ inviteId }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    if (err instanceof DuplicateInviteError || err instanceof AlreadyMemberError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
