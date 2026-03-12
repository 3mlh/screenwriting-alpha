'use client'

import { useState, useTransition } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type State = 'idle' | 'loading' | 'sent' | 'error'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    startTransition(async () => {
      setState('loading')
      setError(null)

      const supabase = getSupabaseBrowserClient()
      const { error: sbError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (sbError) {
        setState('error')
        setError(sbError.message)
      } else {
        setState('sent')
      }
    })
  }

  if (state === 'sent') {
    return (
      <div className="text-center py-2">
        <div className="text-2xl mb-3">✉️</div>
        <p className="text-sm font-medium text-gray-900">Check your email</p>
        <p className="mt-1 text-sm text-gray-500">
          We sent a magic link to <strong>{email}</strong>
        </p>
        <button
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
          onClick={() => { setState('idle'); setEmail('') }}
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoFocus
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent
            placeholder:text-gray-400"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || state === 'loading' || !email.trim()}
        className="w-full py-2 px-4 text-sm font-medium text-white bg-gray-900
          rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors"
      >
        {state === 'loading' ? 'Sending…' : 'Send magic link'}
      </button>
    </form>
  )
}
