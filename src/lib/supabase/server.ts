// ── Server Supabase client ─────────────────────────────────────────────────────
//
// Creates a per-request server client. Call this inside:
//   - Server Components
//   - Route Handlers
//   - Server Actions
//
// Uses @supabase/ssr cookie adapter for Next.js App Router.
// This file is the ONLY place in the codebase that imports createServerClient.
//
// CRITICAL: Always use supabase.auth.getUser() for auth checks — never getSession().
// getSession() only reads the cookie without validating the JWT against Supabase.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll may be called from a Server Component where cookies are read-only.
            // This is safe — the middleware handles cookie refresh.
          }
        },
      },
    }
  )
}
