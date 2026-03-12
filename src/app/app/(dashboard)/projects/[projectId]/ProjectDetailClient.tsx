'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Project } from '@/types/screenplay'
import type { ScriptListItem } from '@/lib/data/scripts'
import { NewScriptModal } from './NewScriptModal'

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

const FORMAT_LABELS: Record<string, string> = {
  feature: 'Feature',
  pilot: 'Pilot',
  spec: 'Spec',
  short: 'Short',
}

export function ProjectDetailClient({
  project,
  scripts,
}: {
  project: Project
  scripts: ScriptListItem[]
}) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="px-8 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-xs text-gray-400">
        <Link href="/app" className="hover:text-gray-700 transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-gray-600">{project.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-semibold text-gray-900"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {project.title}
          </h1>
          {project.description && (
            <p className="mt-1.5 text-sm text-gray-500 max-w-lg">{project.description}</p>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors font-medium flex-shrink-0"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New script
        </button>
      </div>

      {/* Scripts */}
      {scripts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-stone-200">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto mb-3 text-gray-300"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p className="text-sm">No scripts yet.</p>
          <p className="text-xs mt-1">
            <button
              onClick={() => setModalOpen(true)}
              className="text-amber-700 hover:underline font-medium"
            >
              Create your first script
            </button>{' '}
            to start writing.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2.5 pl-5">
                  Title
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2.5 px-4">
                  Format
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2.5 px-4">
                  Modified
                </th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((script) => (
                <tr
                  key={script.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors group"
                >
                  <td className="py-3 pl-5">
                    <Link
                      href={`/app/scripts/${script.id}`}
                      className="flex items-center gap-2.5"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="text-gray-400 flex-shrink-0"
                      >
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-sm text-gray-800 font-medium group-hover:text-amber-800 transition-colors">
                        {script.title}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                      {FORMAT_LABELS[script.format] ?? script.format}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-400">{timeAgo(script.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewScriptModal
        projectId={project.id}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
