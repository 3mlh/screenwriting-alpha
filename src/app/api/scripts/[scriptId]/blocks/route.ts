// PUT /api/scripts/[scriptId]/blocks
//
// Autosave endpoint — replaces the full block array for a script.
// Called by AutosavePlugin every 2s after changes (debounced).
// Also called immediately on Cmd+S.
//
// Security:
//   1. requireScriptRole(supabase, scriptId, 'editor') — app-layer check
//   2. RLS policy on scripts table — DB-layer guarantee
//   3. Zod validation of Block[] before any write
//
// Autosave snapshot cadence:
//   Client sends lastSnapshotAt (ISO string from localStorage).
//   If >30 min has elapsed, server creates an autosave snapshot before writing
//   and returns snapshotId so the client can update localStorage.
//
// Response: { savedAt: string, snapshotId?: string }
// Error:    { error: string } with appropriate status code

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole, requireUser } from '@/lib/auth/permissions'
import { saveScriptBlocks } from '@/lib/data/scripts'
import { toApiError } from '@/lib/auth/errors'
import { validateBlocks } from '@/lib/validation/block.schema'
import { createSnapshot } from '@/lib/revisions/snapshot'
import { replaceScriptSearchChunks } from '@/lib/search/index'
import { z } from 'zod'

type Params = { params: Promise<{ scriptId: string }> }

const AUTOSAVE_SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

const putBlocksSchema = z.object({
  blocks: z.array(z.unknown()),
  // ISO timestamp from client localStorage — used to gate autosave snapshots
  lastSnapshotAt: z.string().datetime().optional().nullable(),
})

export async function PUT(request: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()

    // App-layer auth check (defense in depth alongside RLS)
    await requireScriptRole(supabase, scriptId, 'editor')
    const user = await requireUser(supabase)

    const body = await request.json()
    const { blocks: rawBlocks, lastSnapshotAt } = putBlocksSchema.parse(body)

    // Validate block schema — rejects any malformed data before it hits Postgres
    const blocks = validateBlocks(rawBlocks)

    // Autosave snapshot: create one if >30min since last snapshot
    let snapshotId: string | undefined
    const now = Date.now()
    const needsSnapshot =
      !lastSnapshotAt ||
      now - new Date(lastSnapshotAt).getTime() > AUTOSAVE_SNAPSHOT_INTERVAL_MS

    if (needsSnapshot) {
      try {
        const snap = await createSnapshot(supabase, {
          scriptId,
          userId: user.id,
          blocks,
          triggerType: 'autosave',
        })
        snapshotId = snap.id
      } catch {
        // Snapshot failure is non-fatal — the save still proceeds
      }
    }

    const { updatedAt } = await saveScriptBlocks(supabase, scriptId, blocks)

    void replaceScriptSearchChunks(supabase, user.id, scriptId, blocks).catch((indexError) => {
      console.error('Failed to refresh search index after autosave:', indexError)
    })

    return NextResponse.json({ savedAt: updatedAt, ...(snapshotId ? { snapshotId } : {}) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid block data', details: err.errors }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
