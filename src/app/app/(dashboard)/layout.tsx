import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { AppSidebar } from './AppSidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const profile = await getProfile(supabase, user.id)
  const displayName = profile?.displayName || user.email || ''

  return (
    <div className="flex h-screen overflow-hidden bg-stone-100 dark:bg-stone-950">
      <AppSidebar userEmail={user.email ?? ''} displayName={displayName} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
