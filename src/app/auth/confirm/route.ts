// ── Email confirmation ────────────────────────────────────────────────────────
//
// Handles email confirmation links (OTP token_hash flow).
// Supabase sends this type of link for email signup confirmation.

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { EmailOtpType } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/app'

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/auth/login?error=invalid_link`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.verifyOtp({ type, token_hash })

  if (error) {
    console.error('Email confirm error:', error.message)
    return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
