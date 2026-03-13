import { getSupabaseServerClient } from '@/lib/supabase/server'
import { listSharedProjects } from '@/lib/data/projects'
import { requireUser } from '@/lib/auth/permissions'
import { ProjectCard } from '../ProjectCard'

export const metadata = { title: 'Shared — Writer\'s Room' }

export default async function SharedPage() {
  const supabase = await getSupabaseServerClient()
  const user = await requireUser(supabase)
  const projects = await listSharedProjects(supabase, user.id)

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: 'Georgia, serif' }}>
          Shared with me
        </h1>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-stone-200 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-500">
          <p className="text-sm">Nothing shared with you yet.</p>
          <p className="text-xs mt-1">Projects shared with you will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
