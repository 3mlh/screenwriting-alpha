// GET  /api/projects/[projectId]/members  — list members
// POST /api/projects/[projectId]/members  — invite by email

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser, requireProjectRole } from '@/lib/auth/permissions'
import { listProjectMembers, lookupUserByEmail } from '@/lib/data/members'
import { createInvite, DuplicateInviteError, AlreadyMemberError } from '@/lib/data/invites'
import { sendInviteEmail } from '@/lib/email/sendInvite'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ projectId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    await requireProjectRole(supabase, projectId, 'viewer')

    const members = await listProjectMembers(supabase, projectId)
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
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)
    await requireProjectRole(supabase, projectId, 'owner')

    const body = await request.json()
    const { email, role } = inviteSchema.parse(body)

    const target = await lookupUserByEmail(supabase, email)
    if (!target) {
      return NextResponse.json({ error: 'No account found for that email address' }, { status: 404 })
    }

    const { id: inviteId } = await createInvite(supabase, {
      resourceType: 'project',
      resourceId: projectId,
      invitedUserId: target.userId,
      invitedBy: user.id,
      role,
    })

    // Fetch project title for the email.
    const { data: project } = await supabase
      .from('projects')
      .select('title')
      .eq('id', projectId)
      .single()

    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    await sendInviteEmail({
      toEmail: email,
      inviterName: (inviterProfile as { display_name: string } | null)?.display_name ?? 'A collaborator',
      resourceType: 'project',
      resourceTitle: (project as { title: string } | null)?.title ?? 'a project',
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
