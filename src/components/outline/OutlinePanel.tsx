'use client'

import { useMemo } from 'react'
import { useScriptStore } from '@/stores/scriptStore'
import { deriveOutline } from '@/lib/screenplay/outline'
import type { OutlineNode } from '@/types/screenplay'

// ─── Scroll helper ────────────────────────────────────────────────────────────

function scrollToBlock(blockId: string) {
  const el = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
  if (!el) return

  // The scrollable container is .editor-main. We scroll it manually so we can
  // account for the sticky block-type selector bar at the top of that container.
  const container = document.querySelector('.editor-main')
  if (!container) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  const stickyBar = container.querySelector('.block-type-selector-bar')
  const stickyHeight = stickyBar ? stickyBar.getBoundingClientRect().height : 0

  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const targetScrollTop =
    container.scrollTop + (elRect.top - containerRect.top) - stickyHeight - 16

  container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
}

// ─── Scene row ────────────────────────────────────────────────────────────────

function SceneRow({
  node,
  activeSceneId,
}: {
  node: OutlineNode
  activeSceneId: string | null
}) {
  const isActive = node.id === activeSceneId

  return (
    <div
      className={`outline-scene-row${isActive ? ' outline-scene-row--active' : ''}`}
      onClick={() => scrollToBlock(node.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') scrollToBlock(node.id)
      }}
    >
      <div className="outline-scene-heading">
        {node.sceneNumber != null && (
          <span className="outline-scene-number">{node.sceneNumber}.</span>
        )}
        {node.label}
      </div>
      {node.description && (
        <div className="outline-scene-description">{node.description}</div>
      )}
    </div>
  )
}

// ─── Section group ────────────────────────────────────────────────────────────

function SectionGroup({
  node,
  activeSceneId,
}: {
  node: OutlineNode
  activeSceneId: string | null
}) {
  return (
    <div className="outline-section-group">
      <div className="outline-section-header">{node.label}</div>
      {(node.children ?? []).map((child) =>
        child.type === 'scene' ? (
          <SceneRow key={child.id} node={child} activeSceneId={activeSceneId} />
        ) : (
          <SectionGroup key={child.id} node={child} activeSceneId={activeSceneId} />
        )
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function OutlinePanel() {
  const blocks = useScriptStore((s) => s.blocks)
  const activeSceneId = useScriptStore((s) => s.activeSceneId)
  const outline = useMemo(() => deriveOutline(blocks), [blocks])

  if (outline.length === 0) {
    return (
      <div className="outline-panel outline-panel--empty">
        <p>No scenes yet.</p>
        <p>Add a scene heading to build the outline.</p>
      </div>
    )
  }

  return (
    <div className="outline-panel">
      {outline.map((node) =>
        node.type === 'section' ? (
          <SectionGroup key={node.id} node={node} activeSceneId={activeSceneId} />
        ) : (
          <SceneRow key={node.id} node={node} activeSceneId={activeSceneId} />
        )
      )}
    </div>
  )
}
