import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireProjectRole, requireUser } from '@/lib/auth/permissions'
import { toApiError } from '@/lib/auth/errors'
import { searchProjectScripts } from '@/lib/search/search'
import { getScript } from '@/lib/data/scripts'
import { replaceScriptSearchChunks } from '@/lib/search/index'

type Params = { params: Promise<{ projectId: string }> }

const searchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(20).optional(),
  currentScriptId: z.string().uuid().optional(),
})

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)
    await requireProjectRole(supabase, projectId, 'viewer')

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid search request' }, { status: 400 })
    }
    const input = searchRequestSchema.parse(body)

    let results = await searchProjectScripts(supabase, {
      projectId,
      userId: user.id,
      query: input.query,
      currentScriptId: input.currentScriptId,
      limit: input.limit,
    })

    // Lazy repair path for older scripts created before the search index fix.
    // If the current script has never been indexed, rebuild its chunks once
    // and retry the search so users don't need a manual backfill step.
    if (results.length === 0 && input.currentScriptId) {
      const script = await getScript(supabase, input.currentScriptId)
      if (script && script.projectId === projectId) {
        try {
          await replaceScriptSearchChunks(supabase, user.id, script.id, script.blocks)
          results = await searchProjectScripts(supabase, {
            projectId,
            userId: user.id,
            query: input.query,
            currentScriptId: input.currentScriptId,
            limit: input.limit,
          })
        } catch (reindexError) {
          console.error('Failed to backfill search index during search request:', reindexError)
        }
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? 'Invalid search request' }, { status: 400 })
    }

    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
