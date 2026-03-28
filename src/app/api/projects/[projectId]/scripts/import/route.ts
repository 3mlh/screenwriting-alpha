import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireProjectRole, requireUser } from '@/lib/auth/permissions'
import { createScript } from '@/lib/data/scripts'
import { createSnapshot } from '@/lib/revisions/snapshot'
import { createRevisionSet, setCurrentRevisionSet } from '@/lib/data/revisions'
import { toApiError } from '@/lib/auth/errors'
import { getScriptImporterForFileName } from '@/lib/import/registry'
import {
  ScriptImportNotReadyError,
  ScriptImportParseError,
  UnsupportedImportFormatError,
} from '@/lib/import/types'
import { replaceScriptSearchChunks } from '@/lib/search/index'

type Params = { params: Promise<{ projectId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { projectId } = await params
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)
    await requireProjectRole(supabase, projectId, 'editor')

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Import file is required' }, { status: 400 })
    }

    const importer = getScriptImporterForFileName(file.name)
    const imported = await importer.parse(file)

    const script = await createScript(supabase, user.id, {
      projectId,
      title: imported.title,
      initialBlocks: imported.blocks,
    })

    const openSnapshot = await createSnapshot(supabase, {
      scriptId: script.id,
      userId: user.id,
      blocks: imported.blocks,
      triggerType: 'revision_open',
      label: `Initial Draft — imported from ${imported.format.toUpperCase()}`,
    })
    const revisionSet = await createRevisionSet(supabase, {
      scriptId: script.id,
      userId: user.id,
      name: 'Initial Draft',
      color: '',
      openSnapshotId: openSnapshot.id,
    })
    await setCurrentRevisionSet(supabase, script.id, revisionSet.id)
    script.currentRevisionSetId = revisionSet.id
    try {
      await replaceScriptSearchChunks(supabase, user.id, script.id, imported.blocks)
    } catch (indexError) {
      console.error('Failed to build search index for imported script:', indexError)
    }

    return NextResponse.json(script, { status: 201 })
  } catch (err) {
    if (err instanceof UnsupportedImportFormatError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof ScriptImportParseError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    if (err instanceof ScriptImportNotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 501 })
    }
    const { message, status } = toApiError(err)
    return NextResponse.json({ error: message }, { status })
  }
}
