'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ScreenplayEditor } from '@/components/editor/ScreenplayEditor'
import { OutlinePanel } from '@/components/outline/OutlinePanel'
import { DEMO_BLOCKS } from '@/lib/demo/demoScript'
import { useScriptStore } from '@/stores/scriptStore'

export function EditorPageClient() {
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  const blocks = useScriptStore((s) => s.blocks)
  const isDirty = useScriptStore((s) => s.isDirty)
  const [outlineOpen, setOutlineOpen] = useState(true)

  return (
    <div className="editor-root">
      {/* ── Top toolbar ──────────────────────────────────────────────────── */}
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
          <span className="text-sm font-semibold text-gray-700 tracking-tight">
            Screenwriting Alpha
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">
            {isDemo ? 'The Lighthouse — S01E07' : 'Untitled Script'}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>
            {blocks.length} block{blocks.length !== 1 ? 's' : ''}
          </span>
          <span className={isDirty ? 'text-amber-500' : 'text-green-500'}>
            {isDirty ? 'Unsaved changes' : 'Saved locally'}
          </span>
          <span className="text-gray-300">
            Enter for next block · Shift+Enter to exit dialogue
          </span>
        </div>
      </header>

      {/* ── Content area: sidebar + editor ───────────────────────────────── */}
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
          <ScreenplayEditor initialBlocks={isDemo ? DEMO_BLOCKS : undefined} />
        </main>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <div className="sp-status-bar">
        <span className="sp-status-hint">M1 — Local state only. No backend.</span>
        <span className="ml-auto sp-status-hint">
          DevTools → <code>window.__getBlocks()</code>
        </span>
      </div>
    </div>
  )
}
