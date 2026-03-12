'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ScreenplayEditor } from '@/components/editor/ScreenplayEditor'
import { OutlinePanel } from '@/components/outline/OutlinePanel'
import { SaveIndicator } from '@/components/ui/SaveIndicator'
import { useScriptStore } from '@/stores/scriptStore'
import type { Script } from '@/types/screenplay'

interface Props {
  script: Script
  userId: string
}

export function ScriptEditorClient({ script }: Props) {
  const blocks = useScriptStore((s) => s.blocks)
  const isDirty = useScriptStore((s) => s.isDirty)
  const autosaveStatus = useScriptStore((s) => s.autosaveStatus)
  const setScript = useScriptStore((s) => s.setScript)
  const [outlineOpen, setOutlineOpen] = useState(true)

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
          <span className="text-sm text-gray-500 truncate max-w-xs">{script.title}</span>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
          <SaveIndicator status={autosaveStatus} isDirty={isDirty} />
          <span className="text-gray-300 hidden md:block">
            Enter for next block · Shift+Enter to exit dialogue · ⌘S to save
          </span>
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
            scriptId={script.id}
          />
        </main>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className="sp-status-bar">
<span className="sp-status-hint">
          Last saved {new Date(script.updatedAt).toLocaleTimeString()}
        </span>
        <span className="ml-auto sp-status-hint">
          DevTools → <code>window.__getBlocks()</code>
        </span>
      </div>
    </div>
  )
}
