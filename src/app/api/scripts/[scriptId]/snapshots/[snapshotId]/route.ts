// GET /api/scripts/[scriptId]/snapshots/[snapshotId]
// Returns the full snapshot including blocks. Viewer+ access.

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole } from '@/lib/auth/permissions'
import { getSnapshot } from '@/lib/data/revisions'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ scriptId: string; snapshotId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { scriptId, snapshotId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'viewer')

    const snapshot = await getSnapshot(supabase, snapshotId)
    if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    // Guard: ensure snapshot belongs to this script
    if (snapshot.scriptId !== scriptId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ snapshot })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
