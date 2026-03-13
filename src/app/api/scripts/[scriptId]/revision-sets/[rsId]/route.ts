// PATCH /api/scripts/[scriptId]/revision-sets/[rsId]
//
// Supports two operations via the `action` field:
//   { action: 'close' }                    — close the revision set
//   { action: 'update', name?, color? }    — rename / recolor
//
// Closing:
//   1. Creates a `revision_close` snapshot of current blocks
//   2. Sets close_snapshot_id + closed_at + is_active = false
//   3. Clears scripts.current_revision_set_id

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole, requireUser } from '@/lib/auth/permissions'
import {
  getRevisionSet,
  closeRevisionSet,
  updateRevisionSetMeta,
  setCurrentRevisionSet,
} from '@/lib/data/revisions'
import { createSnapshot } from '@/lib/revisions/snapshot'
import { getScriptBlocks } from '@/lib/data/scripts'
import { toApiError } from '@/lib/auth/errors'
import { z } from 'zod'

type Params = { params: Promise<{ scriptId: string; rsId: string }> }

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('close') }),
  z.object({
    action: z.literal('update'),
    name: z.string().min(1).max(100).optional(),
    color: z.string().regex(/^(#[0-9A-Fa-f]{6}|)$/).optional(),
  }),
])

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { scriptId, rsId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'editor')
    const user = await requireUser(supabase)

    const body = await request.json()
    const input = patchSchema.parse(body)

    const existing = await getRevisionSet(supabase, rsId)
    if (!existing || existing.scriptId !== scriptId) {
      return NextResponse.json({ error: 'Revision set not found' }, { status: 404 })
    }

    if (input.action === 'close') {
      if (!existing.isActive) {
        return NextResponse.json({ error: 'Revision set is already closed' }, { status: 400 })
      }

      // Create close snapshot
      const blocks = await getScriptBlocks(supabase, scriptId)
      if (!blocks) return NextResponse.json({ error: 'Script not found' }, { status: 404 })

      const closeSnapshot = await createSnapshot(supabase, {
        scriptId,
        userId: user.id,
        blocks,
        triggerType: 'revision_close',
        label: `${existing.name} — closed`,
      })

      const revisionSet = await closeRevisionSet(supabase, rsId, closeSnapshot.id)
      await setCurrentRevisionSet(supabase, scriptId, null)

      return NextResponse.json({ revisionSet })
    }

    // action === 'update'
    const { name, color } = input
    if (!name && !color) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }
    const revisionSet = await updateRevisionSetMeta(supabase, rsId, {
      ...(name ? { name } : {}),
      ...(color ? { color } : {}),
    })

    return NextResponse.json({ revisionSet })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
