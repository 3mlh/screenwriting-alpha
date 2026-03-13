// POST /api/scripts/[scriptId]/snapshots/[snapshotId]/restore
//
// Restores a script to an arbitrary snapshot (not tied to a revision set).
// Owner-only. Creates a pre-restore backup snapshot first, then replaces blocks.

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole, requireUser } from '@/lib/auth/permissions'
import { getSnapshot, restoreScriptToSnapshot } from '@/lib/data/revisions'
import { createSnapshot } from '@/lib/revisions/snapshot'
import { getScriptBlocks } from '@/lib/data/scripts'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ scriptId: string; snapshotId: string }> }

export async function POST(_req: Request, { params }: Params) {
  try {
    const { scriptId, snapshotId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'owner')
    const user = await requireUser(supabase)

    const target = await getSnapshot(supabase, snapshotId)
    if (!target || target.scriptId !== scriptId) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }

    // Pre-restore backup
    const currentBlocks = await getScriptBlocks(supabase, scriptId)
    if (!currentBlocks) return NextResponse.json({ error: 'Script not found' }, { status: 404 })

    const backup = await createSnapshot(supabase, {
      scriptId,
      userId: user.id,
      blocks: currentBlocks,
      triggerType: 'manual',
      label: 'Pre-restore backup',
    })

    await restoreScriptToSnapshot(supabase, scriptId, target.blocks)

    return NextResponse.json({
      restoredTo: snapshotId,
      backupSnapshotId: backup.id,
    })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
