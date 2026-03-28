'use client'

import { useMemo } from 'react'
import { useScriptStore } from '@/stores/scriptStore'
import { deriveOutline } from '@/lib/screenplay/outline'
import { scrollToBlock } from '@/lib/editor/scrollToBlock'
import type { OutlineNode } from '@/types/screenplay'

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
