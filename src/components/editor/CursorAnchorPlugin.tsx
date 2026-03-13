'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection } from 'lexical'
import { getParentScreenplayBlock } from './blockTypeUtils'

type Side = 'above' | 'below' | null

export function CursorAnchorPlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext()
  const [side, setSide] = useState<Side>(null)
  const focusedKeyRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)

  // Reusable check: compare focused block's rect against the scroll container's rect
  function checkVisibility() {
    const key = focusedKeyRef.current
    if (!key) { setSide(null); return }

    const dom = editor.getElementByKey(key)
    if (!dom) { setSide(null); return }

    const container = containerRef.current ?? dom.closest('.editor-main') as HTMLElement | null
    if (!container) { setSide(null); return }
    containerRef.current = container

    const domRect = dom.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    if (domRect.bottom < containerRect.top) {
      setSide('above')
    } else if (domRect.top > containerRect.bottom) {
      setSide('below')
    } else {
      setSide(null)
    }
  }

  // Track focused block key on every editor state change
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const block = getParentScreenplayBlock(selection.anchor.getNode())
          focusedKeyRef.current = block ? block.getKey() : null
        } else {
          focusedKeyRef.current = null
        }
      })
      checkVisibility()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Also re-check on scroll so the toast appears/disappears as the user scrolls
  useEffect(() => {
    // Find the scroll container once the editor mounts
    const editorRoot = editor.getRootElement()
    if (!editorRoot) return
    const container = editorRoot.closest('.editor-main') as HTMLElement | null
    if (!container) return
    containerRef.current = container

    const onScroll = () => checkVisibility()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  function scrollToCursor() {
    const key = focusedKeyRef.current
    if (!key) return
    editor.getElementByKey(key)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!side) return null

  return createPortal(
    <button
      onMouseDown={(e) => {
        e.preventDefault() // keep editor focus
        scrollToCursor()
      }}
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        ...(side === 'above' ? { top: '72px' } : { bottom: '40px' }),
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
      aria-label={`Cursor is ${side === 'above' ? 'above' : 'below'} — click to jump back`}
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
        style={{ transform: side === 'above' ? 'rotate(180deg)' : undefined }}
      >
        <polyline points="2 4 6 8 10 4" />
      </svg>
      Jump to cursor
    </button>,
    document.body
  )
}
