// POST /api/scripts/[scriptId]/revision-sets/[rsId]/restore
//
// Restores the script's blocks to the state at open_snapshot time.
// Owner-only (destructive operation).
//
// Steps:
//   1. Validate user is owner
//   2. Create a 'manual' snapshot of CURRENT blocks (pre-restore backup)
//   3. Set scripts.blocks = open_snapshot.blocks
//   4. Return { restoredTo: openSnapshotId, backupSnapshotId }

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole, requireUser } from '@/lib/auth/permissions'
import { getRevisionSet, getSnapshot, restoreScriptToSnapshot } from '@/lib/data/revisions'
import { createSnapshot } from '@/lib/revisions/snapshot'
import { getScriptBlocks } from '@/lib/data/scripts'
import { replaceScriptSearchChunks } from '@/lib/search/index'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ scriptId: string; rsId: string }> }

export async function POST(_req: Request, { params }: Params) {
  try {
    const { scriptId, rsId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'owner')
    const user = await requireUser(supabase)

    const revisionSet = await getRevisionSet(supabase, rsId)
    if (!revisionSet || revisionSet.scriptId !== scriptId) {
      return NextResponse.json({ error: 'Revision set not found' }, { status: 404 })
    }

    const openSnapshot = await getSnapshot(supabase, revisionSet.openSnapshotId)
    if (!openSnapshot) {
      return NextResponse.json({ error: 'Open snapshot not found' }, { status: 404 })
    }

    // Step 2: pre-restore backup
    const currentBlocks = await getScriptBlocks(supabase, scriptId)
    if (!currentBlocks) return NextResponse.json({ error: 'Script not found' }, { status: 404 })

    const backup = await createSnapshot(supabase, {
      scriptId,
      userId: user.id,
      blocks: currentBlocks,
      triggerType: 'manual',
      label: 'Pre-restore backup',
    })

    // Step 3: restore
    await restoreScriptToSnapshot(supabase, scriptId, openSnapshot.blocks)
    try {
      await replaceScriptSearchChunks(supabase, user.id, scriptId, openSnapshot.blocks)
    } catch (indexError) {
      console.error('Failed to refresh search index after revision restore:', indexError)
    }

    return NextResponse.json({
      restoredTo: revisionSet.openSnapshotId,
      backupSnapshotId: backup.id,
    })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
