'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialDisplayName: string
  email: string
}

export function ProfileClient({ initialDisplayName, email }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initials = (displayName || email)[0]?.toUpperCase() ?? '?'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    })

    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save')
      return
    }

    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg">
      {/* Avatar preview */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-2xl font-medium">{initials}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{displayName || email}</p>
          <p className="text-xs text-gray-500">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1.5">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={email}
            maxLength={100}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            This is how your name appears to collaborators. Leave blank to use your email.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <p className="px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-sm text-gray-500">
            {email}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
