// GET  /api/scripts/[scriptId]/revision-sets — list revision sets (viewer+)
// POST /api/scripts/[scriptId]/revision-sets — open new revision set (editor+)
//
// Opening a revision set:
//   1. Creates a `revision_open` snapshot of current blocks
//   2. Inserts a revision_sets row with open_snapshot_id
//   3. Sets scripts.current_revision_set_id

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole, requireUser } from '@/lib/auth/permissions'
import {
  listRevisionSets,
  createRevisionSet,
  setCurrentRevisionSet,
} from '@/lib/data/revisions'
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
    const revisionSets = await listRevisionSets(supabase, scriptId)
    return NextResponse.json({ revisionSets })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

const postSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^(#[0-9A-Fa-f]{6}|)$/, 'Must be a hex color or empty'),
})

export async function POST(request: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'editor')
    const user = await requireUser(supabase)

    const body = await request.json()
    const { name, color } = postSchema.parse(body)

    // Step 1: snapshot current blocks
    const blocks = await getScriptBlocks(supabase, scriptId)
    if (!blocks) return NextResponse.json({ error: 'Script not found' }, { status: 404 })

    const openSnapshot = await createSnapshot(supabase, {
      scriptId,
      userId: user.id,
      blocks,
      triggerType: 'revision_open',
      label: `${name} — opened`,
    })

    // Step 2: create revision set row
    const revisionSet = await createRevisionSet(supabase, {
      scriptId,
      userId: user.id,
      name,
      color,
      openSnapshotId: openSnapshot.id,
    })

    // Step 3: set as current revision set
    await setCurrentRevisionSet(supabase, scriptId, revisionSet.id)

    return NextResponse.json({ revisionSet }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
