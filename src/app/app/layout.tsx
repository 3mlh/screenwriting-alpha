// ── Protected app root layout ──────────────────────────────────────────────────
//
// Auth guard only. The (dashboard) route group adds the sidebar layout;
// the script editor provides its own full-screen layout.

import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return <>{children}</>
}
