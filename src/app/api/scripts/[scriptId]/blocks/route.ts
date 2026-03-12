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
// Response: { savedAt: string }
// Error:    { error: string } with appropriate status code

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole } from '@/lib/auth/permissions'
import { saveScriptBlocks } from '@/lib/data/scripts'
import { toApiError } from '@/lib/auth/errors'
import { validateBlocks } from '@/lib/validation/block.schema'
import { z } from 'zod'

type Params = { params: Promise<{ scriptId: string }> }

const putBlocksSchema = z.object({
  blocks: z.array(z.unknown()),
})

export async function PUT(request: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()

    // App-layer auth check (defense in depth alongside RLS)
    await requireScriptRole(supabase, scriptId, 'editor')

    const body = await request.json()
    const { blocks: rawBlocks } = putBlocksSchema.parse(body)

    // Validate block schema — rejects any malformed data before it hits Postgres
    const blocks = validateBlocks(rawBlocks)

    const { updatedAt } = await saveScriptBlocks(supabase, scriptId, blocks)

    return NextResponse.json({ savedAt: updatedAt })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid block data', details: err.errors }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
