'use client'

// ── RevisionMarkPlugin ─────────────────────────────────────────────────────────
//
// Lexical plugin that renders revision marks on changed blocks when a revision
// set is active. There are two visual layers:
//
//   1. Margin mark — a colored vertical bar in the left gutter, matching the
//      revision set color. Applied as a CSS class + CSS variable on the block's
//      DOM element; the class is set directly on the host element so it survives
//      Lexical re-renders without decorator overhead.
//
//   2. Inline diff overlay — for `modified` blocks only, an absolutely-positioned
//      overlay that renders the character-level diff using colored <span> segments
//      (deletions = red strikethrough, insertions = green underline). The overlay
//      is drawn over the existing text so it doesn't affect the contenteditable.
//
// The plugin responds to:
//   - Changes to the revisionDiffs map in the Zustand store
//   - Lexical editor update listener (block DOM elements may be re-created)
//
// It is a no-op when activeRevisionSet is null.

import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot } from 'lexical'
import { useScriptStore } from '@/stores/scriptStore'
import { $isScreenplayBlockNode } from './nodes/ScreenplayBlockNode'

// CSS class applied to the block's host element when it has a revision mark
const REVISION_MARK_CLASS = 'sp-revision-mark'

// Apply / clear revision marks on a single block DOM element
function applyMark(
  el: HTMLElement,
  color: string,
  hasInlineDiff: boolean,
  inlineDiffHtml: string
) {
  el.classList.add(REVISION_MARK_CLASS)
  el.style.setProperty('--revision-color', color)
  el.dataset.revisionMark = 'true'

  if (hasInlineDiff) {
    // Remove any stale overlay
    el.querySelector('.sp-inline-diff-overlay')?.remove()

    const overlay = document.createElement('div')
    overlay.className = 'sp-inline-diff-overlay'
    overlay.setAttribute('aria-hidden', 'true')
    overlay.innerHTML = inlineDiffHtml
    el.appendChild(overlay)
  }
}

function clearMark(el: HTMLElement) {
  el.classList.remove(REVISION_MARK_CLASS)
  el.style.removeProperty('--revision-color')
  delete el.dataset.revisionMark
  el.querySelector('.sp-inline-diff-overlay')?.remove()
}

// Build the HTML string for the inline diff overlay
function buildInlineDiffHtml(
  segments: { op: 'equal' | 'insert' | 'delete'; text: string }[]
): string {
  return segments
    .map(({ op, text }) => {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      if (op === 'equal') return `<span>${escaped}</span>`
      if (op === 'insert') return `<span class="sp-diff-insert">${escaped}</span>`
      // delete
      return `<span class="sp-diff-delete">${escaped}</span>`
    })
    .join('')
}

export function RevisionMarkPlugin(): null {
  const [editor] = useLexicalComposerContext()
  const activeRevisionSet = useScriptStore((s) => s.activeRevisionSet)
  const revisionDiffs = useScriptStore((s) => s.revisionDiffs)
  // Keep a ref to avoid re-registering the Lexical listener on every store change
  const revisionDiffsRef = useRef(revisionDiffs)
  const activeRevisionSetRef = useRef(activeRevisionSet)

  useEffect(() => {
    revisionDiffsRef.current = revisionDiffs
    activeRevisionSetRef.current = activeRevisionSet
  })

  useEffect(() => {
    // Re-run marks after every Lexical update (DOM elements may be re-created)
    return editor.registerUpdateListener(() => {
      const rs = activeRevisionSetRef.current
      const diffs = revisionDiffsRef.current

      editor.getEditorState().read(() => {
        const root = $getRoot()
        for (const child of root.getChildren()) {
          if (!$isScreenplayBlockNode(child)) continue
          const blockId = child.getBlockId()
          const domEl = editor.getElementByKey(child.getKey()) as HTMLElement | null
          if (!domEl) continue

          if (!rs || !rs.color) {
            clearMark(domEl)
            continue
          }

          const diff = diffs.get(blockId)
          if (!diff) {
            clearMark(domEl)
          } else {
            const inlineDiffHtml =
              diff.changeType === 'modified' && diff.inlineDiff
                ? buildInlineDiffHtml(diff.inlineDiff)
                : ''
            applyMark(domEl, rs.color, !!inlineDiffHtml, inlineDiffHtml)
          }
        }
      })
    })
  }, [editor])

  // Also re-apply immediately when diffs or revision set changes
  useEffect(() => {
    if (!activeRevisionSet || !activeRevisionSet.color) {
      // Clear all marks (no active revision, or revision has no color)
      editor.getEditorState().read(() => {
        const root = $getRoot()
        for (const child of root.getChildren()) {
          if (!$isScreenplayBlockNode(child)) continue
          const domEl = editor.getElementByKey(child.getKey()) as HTMLElement | null
          if (domEl) clearMark(domEl)
        }
      })
      return
    }

    editor.getEditorState().read(() => {
      const root = $getRoot()
      for (const child of root.getChildren()) {
        if (!$isScreenplayBlockNode(child)) continue
        const blockId = child.getBlockId()
        const domEl = editor.getElementByKey(child.getKey()) as HTMLElement | null
        if (!domEl) continue

        const diff = revisionDiffs.get(blockId)
        if (!diff) {
          clearMark(domEl)
        } else {
          const inlineDiffHtml =
            diff.changeType === 'modified' && diff.inlineDiff
              ? buildInlineDiffHtml(diff.inlineDiff)
              : ''
          applyMark(domEl, activeRevisionSet.color, !!inlineDiffHtml, inlineDiffHtml)
        }
      }
    })
  }, [editor, activeRevisionSet, revisionDiffs])

  return null
}
