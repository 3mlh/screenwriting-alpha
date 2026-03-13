'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setTheme, getStoredMode } from '@/lib/theme'
import type { ThemeMode } from '@/lib/theme'

interface Props {
  initialDisplayName: string
  email: string
}

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'light',  label: 'Light',  description: 'Always light' },
  { value: 'dark',   label: 'Dark',   description: 'Always dark' },
  { value: 'system', label: 'System', description: 'Match your OS setting' },
]

export function ProfileClient({ initialDisplayName, email }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read from localStorage after mount (not available during SSR)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  useEffect(() => { setThemeMode(getStoredMode()) }, [])

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

  function handleThemeChange(mode: ThemeMode) {
    setThemeMode(mode)   // Update button highlight immediately
    setTheme(mode)       // Write to localStorage + apply to DOM
  }

  return (
    <div className="max-w-lg">
      {/* Avatar preview */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-2xl font-medium">{initials}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName || email}</p>
          <p className="text-xs text-gray-500 dark:text-stone-400">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={email}
            maxLength={100}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent dark:bg-stone-800 dark:border-stone-600 dark:text-gray-100 dark:placeholder-stone-500"
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-stone-500">
            This is how your name appears to collaborators. Leave blank to use your email.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
          <p className="px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-sm text-gray-500 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-400">
            {email}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </form>

      {/* ── Appearance ───────────────────────────────────────────────────────── */}
      <div className="mt-10 pt-8 border-t border-stone-200 dark:border-stone-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Appearance</h2>
        <p className="text-xs text-gray-500 dark:text-stone-400 mb-4">Choose how Writer&apos;s Room looks to you.</p>

        <div className="flex gap-3">
          {THEME_OPTIONS.map(({ value, label, description }) => {
            const active = themeMode === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-center transition-colors ${
                  active
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500'
                    : 'border-stone-200 hover:border-stone-300 bg-white dark:bg-stone-800 dark:border-stone-700 dark:hover:border-stone-500'
                }`}
              >
                <ThemeIcon mode={value} active={active} />
                <span className={`text-xs font-medium ${active ? 'text-amber-800 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {label}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-stone-500 leading-tight">{description}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ThemeIcon({ mode, active }: { mode: ThemeMode; active: boolean }) {
  const color = active ? '#b45309' : '#9ca3af'
  if (mode === 'light') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    )
  }
  if (mode === 'dark') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
