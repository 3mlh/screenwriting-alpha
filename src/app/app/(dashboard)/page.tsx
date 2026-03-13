// ── Recents (dashboard home) ───────────────────────────────────────────────────

import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { listProjects } from '@/lib/data/projects'
import { listAllScripts } from '@/lib/data/scripts'
import { listMyInvites } from '@/lib/data/invites'
import { requireUser } from '@/lib/auth/permissions'
import { ProjectCard, timeAgo } from './ProjectCard'
import type { ScriptListItem } from '@/lib/data/scripts'
import { PendingInvites } from './PendingInvites'

export const metadata = { title: 'Recents — Writer\'s Room' }

function ScriptRow({ script }: { script: ScriptListItem }) {
  return (
    <tr className="group border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors dark:border-stone-800 dark:hover:bg-stone-800/50">
      <td className="py-3 pl-4">
        <Link href={`/app/scripts/${script.id}`} className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gray-400 flex-shrink-0">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-sm text-gray-800 font-medium group-hover:text-amber-800 transition-colors dark:text-gray-200 dark:group-hover:text-amber-400">
            {script.title}
          </span>
        </Link>
      </td>
      <td className="py-3 px-3 text-xs text-gray-400 dark:text-stone-500">
        {script.projectTitle ? (
          <Link href={`/app/projects/${script.projectId}`} className="hover:text-amber-700 transition-colors dark:hover:text-amber-400">
            {script.projectTitle}
          </Link>
        ) : '—'}
      </td>
      <td className="py-3 px-3 text-xs text-gray-400 dark:text-stone-500">{timeAgo(script.updatedAt)}</td>
    </tr>
  )
}

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient()
  const user = await requireUser(supabase)
  const [allProjects, recentScripts, pendingInvites] = await Promise.all([
    listProjects(supabase),
    listAllScripts(supabase, 10),
    listMyInvites(supabase, user.id),
  ])

  const recentProjects = allProjects.slice(0, 3)

  return (
    <div className="px-8 py-8 max-w-6xl">
      <PendingInvites initialInvites={pendingInvites} />

      {/* Recent projects */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: 'Georgia, serif' }}>
            Recents
          </h2>
          {allProjects.length > 3 && (
            <Link href="/app/projects" className="text-xs text-amber-700 hover:underline font-medium">
              All projects →
            </Link>
          )}
        </div>

        {recentProjects.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-stone-200 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-500">
            <p className="text-sm">No projects yet.</p>
            <p className="text-xs mt-1">Click &quot;+ Create&quot; to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Recent scripts */}
      {recentScripts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: 'Georgia, serif' }}>
              Recent Scripts
            </h2>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden dark:bg-stone-900 dark:border-stone-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 py-2 pl-4">
                    Title
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 py-2 px-3">
                    Project
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 py-2 px-3">
                    Modified
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentScripts.map((script) => (
                  <ScriptRow key={script.id} script={script} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
