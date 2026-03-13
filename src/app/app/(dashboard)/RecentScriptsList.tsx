'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ScriptListItem } from '@/lib/data/scripts'
import { timeAgo } from './ProjectCard'
import { ScriptContextMenu } from './ScriptContextMenu'

export function RecentScriptsList({ initialScripts }: { initialScripts: ScriptListItem[] }) {
  const [scripts, setScripts] = useState(initialScripts)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (renameId) renameInputRef.current?.select()
  }, [renameId])

  function startRename(script: ScriptListItem) {
    setRenameTitle(script.title)
    setRenameId(script.id)
  }

  async function submitRename(scriptId: string) {
    const trimmed = renameTitle.trim()
    if (!trimmed || trimmed === scripts.find(s => s.id === scriptId)?.title) {
      setRenameId(null)
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (res.ok) {
        setScripts(prev => prev.map(s => s.id === scriptId ? { ...s, title: trimmed } : s))
      }
    } finally {
      setRenameId(null)
      setBusy(false)
    }
  }

  async function handleDelete(scriptId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/scripts/${scriptId}`, { method: 'DELETE' })
      if (res.ok) {
        setScripts(prev => prev.filter(s => s.id !== scriptId))
        router.refresh()
      }
    } finally {
      setDeleteConfirmId(null)
      setBusy(false)
    }
  }

  if (scripts.length === 0) return null

  const scriptToDelete = scripts.find(s => s.id === deleteConfirmId)

  return (
    <>
      <div className="bg-white rounded-xl border border-stone-200">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2 pl-4">
                Title
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2 px-3">
                Project
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2 px-3">
                Modified
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {scripts.map((script) => (
              <tr
                key={script.id}
                className="group border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors"
              >
                <td className="py-3 pl-4">
                  {renameId === script.id ? (
                    <input
                      ref={renameInputRef}
                      value={renameTitle}
                      onChange={e => setRenameTitle(e.target.value)}
                      onBlur={() => submitRename(script.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitRename(script.id)
                        if (e.key === 'Escape') setRenameId(null)
                      }}
                      disabled={busy}
                      className="text-sm font-medium text-gray-800 border border-amber-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-amber-400 w-full max-w-xs"
                    />
                  ) : (
                    <Link href={`/app/scripts/${script.id}`} className="flex items-center gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gray-400 flex-shrink-0">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-sm text-gray-800 font-medium group-hover:text-amber-800 transition-colors">
                        {script.title}
                      </span>
                    </Link>
                  )}
                </td>
                <td className="py-3 px-3 text-xs text-gray-400">
                  {script.projectTitle ? (
                    <Link href={`/app/projects/${script.projectId}`} className="hover:text-amber-700 transition-colors">
                      {script.projectTitle}
                    </Link>
                  ) : '—'}
                </td>
                <td className="py-3 px-3 text-xs text-gray-400">{timeAgo(script.updatedAt)}</td>
                <td className="py-3 pr-3">
                  <ScriptContextMenu
                    onRename={() => startRename(script)}
                    onDelete={() => setDeleteConfirmId(script.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirmId && scriptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete script?</h3>
            <p className="text-sm text-gray-500 mb-5">
              &ldquo;{scriptToDelete.title}&rdquo; will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={busy}
                className="px-3 py-1.5 text-sm text-gray-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={busy}
                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
