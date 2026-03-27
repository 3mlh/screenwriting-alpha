'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Project, PermissionLevel } from '@/types/screenplay'
import type { ScriptListItem } from '@/lib/data/scripts'
import { NewScriptModal } from './NewScriptModal'
import { ShareDialog } from '@/components/ui/ShareDialog'
import { ScriptContextMenu } from '@/app/app/(dashboard)/ScriptContextMenu'

const IMPORT_ACCEPT_ATTR = '.pdf,.txt'
const SUPPORTED_IMPORT_EXTENSIONS = new Set(['pdf', 'txt'])

function getFileExtension(fileName: string): string | null {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match ? match[1] : null
}

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

export function ProjectDetailClient({
  project,
  scripts: initialScripts,
  userId,
  currentUserRole,
}: {
  project: Project
  scripts: ScriptListItem[]
  userId: string
  currentUserRole: PermissionLevel
}) {
  const [scripts, setScripts] = useState(initialScripts)
  const [modalOpen, setModalOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const canEdit = currentUserRole === 'owner' || currentUserRole === 'editor'
  const canDelete = currentUserRole === 'owner'

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

  function handleImportClick() {
    if (isImporting) return
    setImportError(null)
    importInputRef.current?.click()
  }

  async function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file) return

    const extension = getFileExtension(file.name)
    if (!extension || !SUPPORTED_IMPORT_EXTENSIONS.has(extension)) {
      setImportError('Only .pdf and .txt imports are supported right now.')
      return
    }

    setImportError(null)
    setImportFileName(file.name)
    setIsImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/projects/${project.id}/scripts/import`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setImportError(json.error ?? 'Failed to import script')
        return
      }

      const script = await res.json()
      router.push(`/app/scripts/${script.id}`)
    } catch {
      setImportError('Failed to import script')
    } finally {
      setIsImporting(false)
      setImportFileName(null)
    }
  }

  const scriptToDelete = scripts.find(s => s.id === deleteConfirmId)

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
          <div className="flex items-center gap-2">
            {project.memberCount > 1 ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-amber-600 mt-0.5" aria-label="Shared">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400 mt-0.5" aria-label="Private">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            )}
            <h1
              className="text-2xl font-semibold text-gray-900"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              {project.title}
            </h1>
          </div>
          {project.description && (
            <p className="mt-1.5 text-sm text-gray-500 max-w-lg">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {canEdit && (
            <input
              ref={importInputRef}
              type="file"
              accept={IMPORT_ACCEPT_ATTR}
              className="sr-only"
              onChange={handleImportChange}
            />
          )}
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 border border-stone-200 text-gray-600 hover:text-gray-900 hover:bg-stone-50 rounded-lg transition-colors font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
          {canEdit && (
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="flex items-center gap-1.5 text-sm px-4 py-2 border border-stone-200 text-gray-700 hover:text-gray-900 hover:bg-stone-50 rounded-lg transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="animate-spin">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-25" />
                    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  Importing…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                  Import script
                </>
              )}
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setModalOpen(true)}
              disabled={isImporting}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors font-medium"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New script
            </button>
          )}
        </div>
      </div>

      {(isImporting || importError) && (
        <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
          importError
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          {isImporting && (
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-25" />
                <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span>Importing {importFileName ?? 'script'}… this can take a bit for larger files.</span>
            </div>
          )}
          {!isImporting && importError && <span>{importError}</span>}
        </div>
      )}

      {/* Scripts */}
      {scripts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-stone-200">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-gray-300">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p className="text-sm">No scripts yet.</p>
          {canEdit && (
            <p className="text-xs mt-1">
              <button onClick={() => setModalOpen(true)} className="text-amber-700 hover:underline font-medium">
                Create your first script
              </button>{' '}
              to start writing, or{' '}
              <button onClick={handleImportClick} className="text-amber-700 hover:underline font-medium">
                import one
              </button>.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2.5 pl-5">
                  Title
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 py-2.5 px-4">
                  Modified
                </th>
                {(canEdit || canDelete) && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {scripts.map((script) => (
                <tr
                  key={script.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors group"
                >
                  <td className="py-3 pl-5">
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
                        {(script.memberCount > 1 || project.memberCount > 1) ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-amber-600" aria-label="Shared">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gray-400 flex-shrink-0" aria-label="Private">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        )}
                        <span className="text-sm text-gray-800 font-medium group-hover:text-amber-800 transition-colors">
                          {script.title}
                        </span>
                      </Link>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-400">{timeAgo(script.updatedAt)}</td>
                  {(canEdit || canDelete) && (
                    <td className="py-3 pr-3">
                      <ScriptContextMenu
                        canRename={canEdit}
                        canDelete={canDelete}
                        onRename={() => startRename(script)}
                        onDelete={() => setDeleteConfirmId(script.id)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      <NewScriptModal
        projectId={project.id}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        resourceType="project"
        resourceId={project.id}
        currentUserId={userId}
        currentUserRole={currentUserRole}
      />
    </div>
  )
}
