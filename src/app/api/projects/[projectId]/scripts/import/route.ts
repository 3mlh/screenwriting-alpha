import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireProjectRole, requireUser } from '@/lib/auth/permissions'
import { toApiError } from '@/lib/auth/errors'

type Params = { params: Promise<{ projectId: string }> }

const SUPPORTED_IMPORT_EXTENSIONS = new Set(['pdf', 'txt'])

function getFileExtension(fileName: string): string | null {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match ? match[1] : null
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    await requireUser(supabase)
    await requireProjectRole(supabase, projectId, 'editor')

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Import file is required' }, { status: 400 })
    }

    const extension = getFileExtension(file.name)
    if (!extension || !SUPPORTED_IMPORT_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: 'Only .pdf and .txt imports are supported right now' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Script import parser is not wired up yet' },
      { status: 501 }
    )
  } catch (err) {
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
