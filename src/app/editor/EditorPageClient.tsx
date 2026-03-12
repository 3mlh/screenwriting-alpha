'use client'

import { useSearchParams } from 'next/navigation'
import { ScreenplayEditor } from '@/components/editor/ScreenplayEditor'
import { DEMO_BLOCKS } from '@/lib/demo/demoScript'
import { useScriptStore } from '@/stores/scriptStore'

export function EditorPageClient() {
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === 'true'
  const blocks = useScriptStore((s) => s.blocks)
  const isDirty = useScriptStore((s) => s.isDirty)

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Toolbar */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
          <span className="text-gray-300">Enter for next block · Shift+Enter to exit dialogue</span>
        </div>
      </header>

      {/* Editor */}
      <main className="flex-1">
        <ScreenplayEditor
          initialBlocks={isDemo ? DEMO_BLOCKS : undefined}
        />
      </main>

      {/* Status bar */}
      <div className="sp-status-bar">
        <span className="sp-status-hint">
          M1 — Local state only. No backend.
        </span>
        <span className="ml-auto sp-status-hint">
          Open DevTools console → <code>window.__getBlocks()</code> to inspect Block[]
        </span>
      </div>
    </div>
  )
}
