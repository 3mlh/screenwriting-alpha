import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/data/profiles'
import { ProfileClient } from './ProfileClient'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const profile = await getProfile(supabase, user.id)

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your display name and account details.</p>
      <ProfileClient
        initialDisplayName={profile?.displayName ?? ''}
        email={user.email ?? ''}
      />
    </div>
  )
}
