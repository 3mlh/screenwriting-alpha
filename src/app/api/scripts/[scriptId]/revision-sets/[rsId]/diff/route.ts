// GET /api/scripts/[scriptId]/revision-sets/[rsId]/diff
//
// Returns BlockDiff[] computed on demand by comparing:
//   - open_snapshot.blocks  (before)
//   - close_snapshot.blocks if closed, or current scripts.blocks if still active (after)
//
// Viewer+ access.

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole } from '@/lib/auth/permissions'
import { getRevisionSet, getSnapshot } from '@/lib/data/revisions'
import { getScriptBlocks } from '@/lib/data/scripts'
import { diffSnapshots } from '@/lib/revisions/diff'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ scriptId: string; rsId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { scriptId, rsId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'viewer')

    const revisionSet = await getRevisionSet(supabase, rsId)
    if (!revisionSet || revisionSet.scriptId !== scriptId) {
      return NextResponse.json({ error: 'Revision set not found' }, { status: 404 })
    }

    const openSnapshot = await getSnapshot(supabase, revisionSet.openSnapshotId)
    if (!openSnapshot) {
      return NextResponse.json({ error: 'Open snapshot not found' }, { status: 404 })
    }

    // "After" is either the close snapshot (if closed) or the live blocks
    let afterBlocks
    if (revisionSet.closeSnapshotId) {
      const closeSnapshot = await getSnapshot(supabase, revisionSet.closeSnapshotId)
      afterBlocks = closeSnapshot?.blocks ?? []
    } else {
      afterBlocks = (await getScriptBlocks(supabase, scriptId)) ?? []
    }

    const diffs = diffSnapshots(openSnapshot.blocks, afterBlocks, rsId)
    return NextResponse.json({ diffs })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
