import { getSupabaseServerClient } from '@/lib/supabase/server'
import { listProjects } from '@/lib/data/projects'
import { requireUser } from '@/lib/auth/permissions'
import { ProjectCard } from '../ProjectCard'

export const metadata = { title: 'All Projects — Writer\'s Room' }

export default async function AllProjectsPage() {
  const supabase = await getSupabaseServerClient()
  await requireUser(supabase)
  const projects = await listProjects(supabase)

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
          All Projects
        </h1>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-stone-200">
          <p className="text-sm">No projects yet.</p>
          <p className="text-xs mt-1">Click &quot;+ Create&quot; to get started.</p>
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
