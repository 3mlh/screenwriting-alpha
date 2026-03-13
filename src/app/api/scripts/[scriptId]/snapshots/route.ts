// GET  /api/scripts/[scriptId]/snapshots — list snapshot metadata (no blocks)
// POST /api/scripts/[scriptId]/snapshots — create manual snapshot
//
// Security: viewer+ for GET, editor+ for POST

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole } from '@/lib/auth/permissions'
import { requireUser } from '@/lib/auth/permissions'
import { listSnapshots } from '@/lib/data/revisions'
import { createSnapshot } from '@/lib/revisions/snapshot'
import { getScriptBlocks } from '@/lib/data/scripts'
import { toApiError } from '@/lib/auth/errors'
import { z } from 'zod'

type Params = { params: Promise<{ scriptId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'viewer')
    const snapshots = await listSnapshots(supabase, scriptId)
    return NextResponse.json({ snapshots })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

const postSchema = z.object({
  label: z.string().max(200).optional(),
})

export async function POST(request: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'editor')
    const user = await requireUser(supabase)

    const body = await request.json()
    const { label } = postSchema.parse(body)

    const blocks = await getScriptBlocks(supabase, scriptId)
    if (!blocks) return NextResponse.json({ error: 'Script not found' }, { status: 404 })

    const snapshot = await createSnapshot(supabase, {
      scriptId,
      userId: user.id,
      blocks,
      triggerType: 'manual',
      label,
    })

    return NextResponse.json({ snapshot }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
