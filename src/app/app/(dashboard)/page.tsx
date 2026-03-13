// ── Recents (dashboard home) ───────────────────────────────────────────────────

import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'

import { listProjects } from '@/lib/data/projects'
import { listAllScripts } from '@/lib/data/scripts'
import { listMyInvites } from '@/lib/data/invites'
import { requireUser } from '@/lib/auth/permissions'
import { ProjectCard } from './ProjectCard'
import { RecentScriptsList } from './RecentScriptsList'
import { PendingInvites } from './PendingInvites'

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
          <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Recent Projects
          </h2>
          {allProjects.length > 3 && (
            <Link href="/app/projects" className="text-xs text-amber-700 hover:underline font-medium">
              All projects →
            </Link>
          )}
        </div>

        {recentProjects.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-stone-200">
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
            <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
              Recent Scripts
            </h2>
          </div>
          <RecentScriptsList initialScripts={recentScripts} />
        </div>
      )}
    </div>
  )
}
