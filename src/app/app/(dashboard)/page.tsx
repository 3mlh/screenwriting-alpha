// ── Project browser (dashboard) ────────────────────────────────────────────────
//
// RSC — fetches projects (and recent scripts) server-side.

import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { listProjects } from '@/lib/data/projects'
import { listAllScripts } from '@/lib/data/scripts'
import type { Project } from '@/types/screenplay'
import type { ScriptListItem } from '@/lib/data/scripts'

export const metadata = { title: 'Home — Writer\'s Room' }

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateString: string): string {
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

// ── Screenplay preview thumbnail ───────────────────────────────────────────────

function ScriptPreview() {
  return (
    <div className="relative h-36 overflow-hidden bg-white px-5 pt-3 font-mono select-none">
      {/* Simulated screenplay blocks at ~7px */}
      <div style={{ fontSize: '6.5px', lineHeight: '1.6', color: '#1a1a1a' }}>
        <p className="font-bold uppercase mb-1">FADE IN:</p>
        <p className="font-bold uppercase mb-1">INT. LOCATION &mdash; DAY</p>
        <p className="mb-1 opacity-70">Action description goes here. A character enters the room.</p>
        <p className="uppercase text-center mb-0.5">CHARACTER</p>
        <p className="mb-1 opacity-70" style={{ marginLeft: '10%', marginRight: '10%' }}>
          Dialogue line here. Something meaningful is said.
        </p>
        <p className="font-bold uppercase mb-1">INT. ANOTHER LOCATION &mdash; NIGHT</p>
        <p className="mb-1 opacity-70">More action here. The scene continues with more text.</p>
        <p className="uppercase text-center mb-0.5">OTHER CHARACTER</p>
        <p className="opacity-70" style={{ marginLeft: '10%', marginRight: '10%' }}>
          A response. The conversation escalates.
        </p>
      </div>
      {/* Fade-out gradient */}
      <div
        className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
      />
    </div>
  )
}

// ── Project card ───────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="group block bg-white rounded-xl overflow-hidden border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all"
    >
      {/* Preview */}
      <div className="border-b border-stone-100 overflow-hidden">
        <div className="flex items-start justify-between px-3 pt-2.5 pb-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Script
          </span>
        </div>
        <ScriptPreview />
      </div>

      {/* Info */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-800 transition-colors">
          {project.title}
        </h3>
        {project.description ? (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{project.description}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">No description</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-400">{timeAgo(project.updatedAt)}</span>
        </div>
      </div>
    </Link>
  )
}

// ── Recent scripts table ───────────────────────────────────────────────────────

function ScriptRow({ script }: { script: ScriptListItem }) {
  return (
    <tr className="group border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors">
      <td className="py-3 pl-4">
        <Link
          href={`/app/scripts/${script.id}`}
          className="flex items-center gap-2.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gray-400 flex-shrink-0">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-sm text-gray-800 font-medium hover:text-amber-800 transition-colors">
            {script.title}
          </span>
        </Link>
      </td>
      <td className="py-3 px-3 text-xs text-gray-400">{timeAgo(script.updatedAt)}</td>
    </tr>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient()
  const [projects, recentScripts] = await Promise.all([
    listProjects(supabase),
    listAllScripts(supabase, 8),
  ])

  return (
    <div className="px-8 py-8 max-w-6xl">
      {/* Projects section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Projects
          </h2>
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

      {/* Recent scripts section */}
      {recentScripts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
              Recent Scripts
            </h2>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="flex items-center gap-1 px-4 py-2.5 border-b border-stone-100">
              <button className="text-xs font-medium text-gray-700 px-3 py-1 rounded-full bg-stone-100">
                Recently edited
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2 pl-4">
                    Title
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2 px-3">
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
