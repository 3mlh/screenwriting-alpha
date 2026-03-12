// ── Login page ────────────────────────────────────────────────────────────────
//
// Magic-link auth only. No passwords to manage.
// On submit: calls Supabase signInWithOtp → user gets an email link.
// After clicking the link, Supabase redirects to /auth/callback which
// exchanges the token and sets the session cookie.

import { LoginForm } from './LoginForm'

export const metadata = { title: 'Sign in — Screenwriting Alpha' }

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Screenwriting Alpha
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to access your scripts
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          We&apos;ll send you a magic link — no password needed.
        </p>
      </div>
    </div>
  )
}
