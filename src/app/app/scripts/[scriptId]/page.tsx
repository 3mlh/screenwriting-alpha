// ── Script editor page ─────────────────────────────────────────────────────────
//
// RSC wrapper — fetches the script + blocks server-side, then hands off to
// the client editor. This keeps the initial data load fast (no client fetch
// waterfall) and means the editor is already populated on first paint.

import { notFound, redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getScript } from '@/lib/data/scripts'
import { ScriptEditorClient } from './ScriptEditorClient'

type Props = { params: Promise<{ scriptId: string }> }

export async function generateMetadata({ params }: Props) {
  const { scriptId } = await params
  const supabase = await getSupabaseServerClient()
  const script = await getScript(supabase, scriptId)
  return { title: script ? `${script.title} — Screenwriting Alpha` : 'Editor' }
}

export default async function ScriptEditorPage({ params }: Props) {
  const { scriptId } = await params
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const script = await getScript(supabase, scriptId)
  if (!script) notFound()

  return (
    <ScriptEditorClient
      script={script}
      userId={user.id}
    />
  )
}
