'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { CreateModal } from './CreateModal'

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}


interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
}

function NavItem({ href, icon, label, active, disabled }: NavItemProps) {
  if (disabled) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-400 cursor-not-allowed select-none">
        <span className="flex-shrink-0 opacity-60">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
    )
  }
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
        active
          ? 'bg-amber-100 text-amber-900 font-medium'
          : 'text-gray-600 hover:bg-stone-200 hover:text-gray-900'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-sm">{label}</span>
    </Link>
  )
}

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)

  function handleSignOut() {
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
      router.refresh()
    })
  }

  const isHome = pathname === '/app'

  // Derive initials for avatar
  const initials = userEmail
    ? userEmail[0].toUpperCase()
    : '?'

  return (
    <>
      <aside className="w-60 flex-shrink-0 flex flex-col h-screen bg-stone-100 border-r border-stone-200">
        {/* Logo */}
        <div className="px-4 pt-5 pb-3">
          <Link href="/app" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">W</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Writer&apos;s Room</span>
          </Link>
        </div>

        {/* Create button */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create
          </button>
        </div>

        {/* Nav */}
        <nav className="px-3 flex-1 overflow-y-auto space-y-0.5">
          <NavItem href="/app" icon={<HomeIcon />} label="Home" active={isHome} />

          <div className="pt-4 pb-1 px-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Library</span>
          </div>
          <NavItem href="/app" icon={<FolderIcon />} label="All Projects" active={!isHome && pathname.startsWith('/app/projects')} />
          <NavItem href="/app" icon={<DocIcon />} label="Scripts" disabled />
          <NavItem href="/app" icon={<UsersIcon />} label="Shared" disabled />
          <NavItem href="/app" icon={<TrashIcon />} label="Trash" disabled />
        </nav>

        {/* Footer — user */}
        <div className="px-4 py-4 border-t border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-medium">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 truncate">{userEmail}</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isPending}
              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50 flex-shrink-0"
              title="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}
