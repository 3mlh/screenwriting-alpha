// GET    /api/scripts/[scriptId]  — get script with blocks
// PATCH  /api/scripts/[scriptId]  — update title
// DELETE /api/scripts/[scriptId]  — delete script (owner)

import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireScriptRole } from '@/lib/auth/permissions'
import { getScript, updateScriptMeta, deleteScript } from '@/lib/data/scripts'
import { toApiError, NotFoundError } from '@/lib/auth/errors'
import { z } from 'zod'

type Params = { params: Promise<{ scriptId: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'viewer')

    const script = await getScript(supabase, scriptId)
    if (!script) throw new NotFoundError('Script')
    return NextResponse.json(script)
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'editor')

    const body = await request.json()
    const update = patchSchema.parse(body)

    const script = await updateScriptMeta(supabase, scriptId, update)
    if (!script) throw new NotFoundError('Script')
    return NextResponse.json(script)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { scriptId } = await params
    const supabase = await getSupabaseServerClient()
    await requireScriptRole(supabase, scriptId, 'owner')
    await deleteScript(supabase, scriptId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
