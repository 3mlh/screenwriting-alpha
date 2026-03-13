'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/components/ui/Dialog'

type Step = 'choose' | 'project' | 'script'

interface ProjectOption {
  id: string
  title: string
}

export function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choose')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const titleRef = useRef<HTMLInputElement>(null)

  // Load projects when script step is reached
  useEffect(() => {
    if (step !== 'script') return
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data: ProjectOption[]) => {
        setProjects(data)
        if (data.length > 0) setProjectId(data[0].id)
      })
      .catch(() => {})
  }, [step])

  useEffect(() => {
    if (step !== 'choose') {
      setTimeout(() => titleRef.current?.focus(), 60)
    }
  }, [step])

  function reset() {
    setStep('choose')
    setTitle('')
    setDescription('')
    setProjectId('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      setError(null)
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to create project')
        return
      }

      const project = await res.json()
      handleClose()
      router.push(`/app/projects/${project.id}`)
      router.refresh()
    })
  }

  function handleCreateScript(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !projectId) return

    startTransition(async () => {
      setError(null)
      const res = await fetch(`/api/projects/${projectId}/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to create script')
        return
      }

      const script = await res.json()
      handleClose()
      router.push(`/app/scripts/${script.id}`)
    })
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {step !== 'choose' && (
              <button
                onClick={() => { setStep('choose'); setError(null) }}
                className="mr-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Back"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <span className="text-base font-semibold text-gray-900">
              {step === 'choose' ? 'Create new' : step === 'project' ? 'New project' : 'New script'}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Choose step */}
        {step === 'choose' && (
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-5">What would you like to create?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep('project')}
                className="flex flex-col items-start p-4 rounded-xl border-2 border-gray-100 hover:border-amber-300 hover:bg-amber-50 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center mb-3 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-700">
                    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-900">New Project</span>
                <span className="text-xs text-gray-500 mt-0.5 leading-snug">Organize scripts in a folder</span>
              </button>

              <button
                onClick={() => setStep('script')}
                className="flex flex-col items-start p-4 rounded-xl border-2 border-gray-100 hover:border-amber-300 hover:bg-amber-50 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center mb-3 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-700">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-900">New Script</span>
                <span className="text-xs text-gray-500 mt-0.5 leading-snug">Start writing immediately</span>
              </button>
            </div>
          </div>
        )}

        {/* New project form */}
        {step === 'project' && (
          <form onSubmit={handleCreateProject} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Project title <span className="text-red-400">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Severance Season 3"
                maxLength={200}
                required
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this project about?"
                maxLength={500}
                rows={3}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
              />
            </div>
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isPending || !title.trim()}
                className="flex-1 text-sm py-2.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isPending ? 'Creating…' : 'Create project'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="text-sm px-4 py-2.5 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* New script form */}
        {step === 'script' && (
          <form onSubmit={handleCreateScript} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Script title <span className="text-red-400">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. Episode 1 — "Pilot"'
                maxLength={200}
                required
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>
            <div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Project <span className="text-red-400">*</span>
                </label>
                {projects.length === 0 ? (
                  <div className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                    Loading…
                  </div>
                ) : (
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            {projects.length === 0 && step === 'script' && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                You need a project first. <button type="button" onClick={() => setStep('project')} className="underline font-medium">Create one</button>
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isPending || !title.trim() || !projectId}
                className="flex-1 text-sm py-2.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isPending ? 'Creating…' : 'Create script'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="text-sm px-4 py-2.5 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  )
}
