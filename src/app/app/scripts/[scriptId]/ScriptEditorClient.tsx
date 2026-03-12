'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ScreenplayEditor } from '@/components/editor/ScreenplayEditor'
import { OutlinePanel } from '@/components/outline/OutlinePanel'
import { SaveIndicator } from '@/components/ui/SaveIndicator'
import { ShareDialog } from '@/components/ui/ShareDialog'
import { useScriptStore } from '@/stores/scriptStore'
import type { Script, PermissionLevel } from '@/types/screenplay'

interface Props {
  script: Script
  userId: string
  readOnly?: boolean
  currentUserRole?: PermissionLevel
}

export function ScriptEditorClient({ script, userId, readOnly = false, currentUserRole = 'viewer' }: Props) {
  const isDirty = useScriptStore((s) => s.isDirty)
  const autosaveStatus = useScriptStore((s) => s.autosaveStatus)
  const setScript = useScriptStore((s) => s.setScript)
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)

  // Register the script in the store so AutosavePlugin can read the scriptId
  useEffect(() => {
    setScript(script)
    return () => setScript(null)
  }, [script, setScript])

  return (
    <div className="editor-root">
      {/* ── Top toolbar ────────────────────────────────────────────────────── */}
      <header className="editor-toolbar">
        <div className="flex items-center gap-3">
          <button
            className="editor-toolbar-icon-btn"
            onClick={() => setOutlineOpen((o) => !o)}
            aria-label={outlineOpen ? 'Hide outline' : 'Show outline'}
            title={outlineOpen ? 'Hide outline' : 'Show outline'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="1" y="11.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>

          <Link
            href={`/app/projects/${script.projectId}`}
            className="text-sm font-semibold text-gray-700 hover:text-gray-900 tracking-tight"
          >
            Screenwriting Alpha
          </Link>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1.5 min-w-0">
            {(script.memberCount > 1 || script.projectMemberCount > 1) ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-amber-600" aria-label="Shared">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400" aria-label="Private">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            )}
            <span className="text-sm text-gray-500 truncate max-w-xs">{script.title}</span>
          </span>

          {readOnly && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
              Read only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        </div>
      </header>

      {/* ── Content area ───────────────────────────────────────────────────── */}
      <div className="editor-content">
        {outlineOpen && (
          <aside className="editor-outline-sidebar">
            <div className="outline-sidebar-header">
              <span className="outline-sidebar-title">Outline</span>
            </div>
            <div className="outline-sidebar-body">
              <OutlinePanel />
            </div>
          </aside>
        )}

        <main className="editor-main">
          <ScreenplayEditor
            initialBlocks={script.blocks}
            scriptId={readOnly ? undefined : script.id}
            readOnly={readOnly}
          />
        </main>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className="sp-status-bar">
        {!readOnly && (
          <span className="sp-status-hint flex items-center gap-2">
            <SaveIndicator status={autosaveStatus} isDirty={isDirty} />
            <span className="text-stone-300">·</span>
            Last saved {new Date(script.updatedAt).toLocaleTimeString()}
          </span>
        )}
        <span className="ml-auto sp-status-hint">
          DevTools → <code>window.__getBlocks()</code>
        </span>
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        resourceType="script"
        resourceId={script.id}
        currentUserId={userId}
        currentUserRole={currentUserRole}
      />
    </div>
  )
}
