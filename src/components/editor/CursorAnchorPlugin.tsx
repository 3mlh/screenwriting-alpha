'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalNode,
} from 'lexical'
import { getParentScreenplayBlock } from './blockTypeUtils'
import { $isScreenplayBlockNode } from './nodes/ScreenplayBlockNode'
import { useScriptStore } from '@/stores/scriptStore'
import { scrollToBlock } from '@/lib/editor/scrollToBlock'
import type { CursorAnchor } from '@/types/screenplay'

type Side = 'above' | 'below' | null

interface ToastPos {
  side: Side
  centerX: number   // px from left edge of viewport
  topY: number      // px from top (used when side === 'above')
  bottomY: number   // px from bottom of viewport (used when side === 'below')
}

export function CursorAnchorPlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext()
  const [pos, setPos] = useState<ToastPos | null>(null)
  const focusedKeyRef = useRef<string | null>(null)
  const focusedBlockIdRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const [returnHighlightBlockId, setReturnHighlightBlockId] = useState<string | null>(null)
  const jumpHighlightBlockId = useScriptStore((s) => s.jumpHighlightBlockId)
  const lastCursorAnchor = useScriptStore((s) => s.lastCursorAnchor)

  function getFirstSelectableText(node: LexicalNode | null): LexicalNode | null {
    if (!node) return null
    if ($isTextNode(node)) return node
    if ($isElementNode(node)) {
      let child: LexicalNode | null = node.getFirstChild()
      while (child) {
        const found = getFirstSelectableText(child)
        if (found) return found
        child = child.getNextSibling()
      }
    }
    return null
  }

  function restoreCursorSelection(anchor: CursorAnchor | null): string | null {
    const targetBlockId = anchor?.blockId ?? focusedBlockIdRef.current
    if (!targetBlockId) return null

    let restored = false

    editor.update(
      () => {
        const root = $getRoot()
        for (const child of root.getChildren()) {
          if (!$isScreenplayBlockNode(child)) continue
          if (child.getBlockId() !== targetBlockId) continue

          const textNode = getFirstSelectableText(child)
          if (textNode && $isTextNode(textNode)) {
            const maxOffset = textNode.getTextContent().length
            const offset = anchor ? Math.max(0, Math.min(anchor.offset, maxOffset)) : maxOffset
            textNode.select(offset, offset)
          } else {
            child.selectEnd()
          }

          restored = true
          focusedKeyRef.current = child.getKey()
          focusedBlockIdRef.current = child.getBlockId()
          return
        }
      },
      { discrete: true }
    )

    if (!restored) return null
    editor.focus()
    return targetBlockId
  }

  function computePos(): ToastPos | null {
    const key = focusedKeyRef.current
    if (!key) return null

    const dom = editor.getElementByKey(key)
    if (!dom) return null

    const container = containerRef.current
    if (!container) return null

    const domRect = dom.getBoundingClientRect()
    const cRect = container.getBoundingClientRect()

    // Center the toast over the editor-main column
    const centerX = cRect.left + cRect.width / 2

    // The block-type-selector-bar is sticky at the top of the container.
    // Measure it so we can clear it.
    const blockBar = container.querySelector('.block-type-selector-bar') as HTMLElement | null
    const blockBarH = blockBar ? blockBar.getBoundingClientRect().height : 0

    let side: Side = null
    if (domRect.bottom < cRect.top + blockBarH) {
      side = 'above'
    } else if (domRect.top > cRect.bottom) {
      side = 'below'
    } else if (
      jumpHighlightBlockId &&
      focusedBlockIdRef.current &&
      jumpHighlightBlockId !== focusedBlockIdRef.current
    ) {
      const jumpDom = container.querySelector(
        `[data-block-id="${CSS.escape(jumpHighlightBlockId)}"]`
      ) as HTMLElement | null

      if (jumpDom) {
        const jumpRect = jumpDom.getBoundingClientRect()
        side = domRect.top <= jumpRect.top ? 'above' : 'below'
      }
    }

    if (!side) return null

    return {
      side,
      centerX,
      topY: cRect.top + blockBarH + 8,
      bottomY: window.innerHeight - cRect.bottom + 8,
    }
  }

  function refresh() {
    setPos(computePos())
  }

  // Track focused block key on every editor state change
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection()
        if ($isRangeSelection(sel)) {
          const block = getParentScreenplayBlock(sel.anchor.getNode())
          focusedKeyRef.current = block ? block.getKey() : null
          focusedBlockIdRef.current = block ? block.getBlockId() : null
        } else {
          focusedKeyRef.current = null
          focusedBlockIdRef.current = null
        }
      })
      refresh()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Attach scroll listener and cache container ref once editor mounts
  useEffect(() => {
    const editorRoot = editor.getRootElement()
    if (!editorRoot) return
    const container = editorRoot.closest('.editor-main') as HTMLElement | null
    if (!container) return
    containerRef.current = container

    container.addEventListener('scroll', refresh, { passive: true })
    window.addEventListener('resize', refresh)
    return () => {
      container.removeEventListener('scroll', refresh)
      window.removeEventListener('resize', refresh)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  useEffect(() => {
    refresh()
  }, [jumpHighlightBlockId])

  useEffect(() => {
    if (!returnHighlightBlockId) return

    const container = containerRef.current
    if (!container) return

    const el = container.querySelector(
      `[data-block-id="${CSS.escape(returnHighlightBlockId)}"]`
    ) as HTMLElement | null
    if (!el) return

    el.dataset.cursorReturnHighlight = 'true'

    const timeout = window.setTimeout(() => {
      if (el.dataset.cursorReturnHighlight) {
        delete el.dataset.cursorReturnHighlight
      }
      setReturnHighlightBlockId((current) =>
        current === returnHighlightBlockId ? null : current
      )
    }, 2000)

    return () => {
      window.clearTimeout(timeout)
      if (el.dataset.cursorReturnHighlight) {
        delete el.dataset.cursorReturnHighlight
      }
    }
  }, [returnHighlightBlockId])

  if (!pos) return null

  return createPortal(
    <button
      onMouseDown={(e) => {
        e.preventDefault() // keep editor focus
        const restoredBlockId = restoreCursorSelection(lastCursorAnchor)
        if (!restoredBlockId) return

        scrollToBlock(restoredBlockId, { placement: 'center' })
        setReturnHighlightBlockId(restoredBlockId)
      }}
      style={{
        position: 'fixed',
        left: pos.centerX,
        transform: 'translateX(-50%)',
        ...(pos.side === 'above'
          ? { top: pos.topY }
          : { bottom: pos.bottomY }),
        zIndex: 50,
      }}
      className="
        flex items-center gap-1.5
        px-3 py-1.5
        rounded-full
        bg-stone-800/90 backdrop-blur-sm
        text-white text-xs font-medium
        shadow-lg
        hover:bg-stone-700/90
        transition-colors
        cursor-pointer
        select-none
      "
      aria-label={`Cursor is ${pos.side === 'above' ? 'above' : 'below'} — click to jump back`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ transform: pos.side === 'above' ? 'rotate(180deg)' : undefined }}
      >
        <polyline points="2 4 6 8 10 4" />
      </svg>
      Jump to cursor
    </button>,
    document.body
  )
}
