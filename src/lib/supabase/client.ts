// ── Browser Supabase client ───────────────────────────────────────────────────
//
// Singleton — safe to call multiple times; returns the same instance.
// Use this ONLY in Client Components (marked 'use client').
// NEVER use this for data writes; use Server Actions or Route Handlers instead.
// This file is the ONLY place in the codebase that imports createBrowserClient.

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

let _client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (_client) return _client

  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return _client
}
