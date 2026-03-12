import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/permissions'
import { getProfile, updateProfile } from '@/lib/data/profiles'

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)
    const profile = await getProfile(supabase, user.id)
    return NextResponse.json({ ...profile, email: user.email })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await getSupabaseServerClient()
    const user = await requireUser(supabase)

    const body = await request.json()
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : undefined

    if (displayName === undefined) {
      return NextResponse.json({ error: 'displayName is required' }, { status: 400 })
    }
    if (displayName.length > 100) {
      return NextResponse.json({ error: 'Display name too long (max 100 characters)' }, { status: 400 })
    }

    const profile = await updateProfile(supabase, user.id, { displayName })
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    return NextResponse.json({ ...profile, email: user.email })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
