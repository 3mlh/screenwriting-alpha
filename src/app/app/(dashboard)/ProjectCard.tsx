import Link from 'next/link'
import type { Project } from '@/types/screenplay'

export function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  const w = Math.floor(diff / 604800000)
  if (m < 2) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  if (w < 5) return `${w}w ago`
  return new Date(dateString).toLocaleDateString()
}

const GRADIENTS = [
  'from-amber-200 via-orange-100 to-yellow-100',
  'from-sky-200 via-blue-100 to-indigo-100',
  'from-emerald-200 via-teal-100 to-cyan-100',
  'from-violet-200 via-purple-100 to-fuchsia-100',
  'from-rose-200 via-pink-100 to-red-100',
  'from-lime-200 via-green-100 to-emerald-100',
  'from-orange-200 via-amber-100 to-yellow-50',
  'from-indigo-200 via-blue-100 to-sky-100',
]

export function cardGradient(id: string): string {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[sum % GRADIENTS.length]
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="group block bg-white rounded-xl overflow-hidden border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all dark:bg-stone-900 dark:border-stone-700 dark:hover:border-stone-500"
    >
      <div className={`h-28 bg-gradient-to-br ${cardGradient(project.id)} opacity-90 dark:opacity-40`} />
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {project.memberCount > 1 ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-amber-600" aria-label="Shared">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400" aria-label="Private">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
          <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-800 transition-colors dark:text-gray-100 dark:group-hover:text-amber-400">
            {project.title}
          </h3>
        </div>
        {project.description ? (
          <p className="text-xs text-gray-500 dark:text-stone-400 mt-0.5 truncate">{project.description}</p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-stone-500 mt-0.5">No description</p>
        )}
        <div className="flex items-center gap-2.5 mt-2">
          <span className="text-[11px] text-gray-400 dark:text-stone-500">{timeAgo(project.updatedAt)}</span>
          <span className="text-gray-200 dark:text-stone-600">·</span>
          <span className="text-[11px] text-gray-400 dark:text-stone-500">
            {project.scriptCount} {project.scriptCount === 1 ? 'script' : 'scripts'}
          </span>
        </div>
      </div>
    </Link>
  )
}
