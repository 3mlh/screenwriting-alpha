'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection } from 'lexical'
import { getParentScreenplayBlock } from './blockTypeUtils'
import { PinIcon } from '@/components/ui/icons/PinIcon'
import { useScriptStore } from '@/stores/scriptStore'

interface VisiblePin {
  blockId: string
  left: number
  top: number
  pinned: boolean
}

export function WritingPinPlugin({
  scriptId,
}: {
  scriptId: string
}): React.ReactElement | null {
  const [editor] = useLexicalComposerContext()
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [visiblePins, setVisiblePins] = useState<VisiblePin[]>([])
  const writingPin = useScriptStore((s) => s.writingPin)
  const setWritingPin = useScriptStore((s) => s.setWritingPin)
  const clearWritingPin = useScriptStore((s) => s.clearWritingPin)
  const pinnedBlockId =
    writingPin?.scriptId === scriptId ? writingPin.blockId : null

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          setFocusedBlockId(null)
          return
        }

        const block = getParentScreenplayBlock(selection.anchor.getNode())
        setFocusedBlockId(block?.getBlockId() ?? null)
      })
    })
  }, [editor])

  useEffect(() => {
    const rootEl = editor.getRootElement()
    if (!rootEl) return
    const root: HTMLElement = rootEl
    const containerEl = root.closest('.editor-main') as HTMLElement | null
    if (!containerEl) return
    const container: HTMLElement = containerEl

    function getPos(blockId: string): Omit<VisiblePin, 'pinned'> | null {
      const block = root.querySelector(
        `[data-block-id="${CSS.escape(blockId)}"]`
      ) as HTMLElement | null

      if (!block) return null

      const rect = block.getBoundingClientRect()
      const page = block.closest('.screenplay-page') as HTMLElement | null
      const pageRect = page?.getBoundingClientRect()

      return {
        blockId,
        top: rect.top + Math.max((rect.height - 20) / 2, 0),
        left: (pageRect?.left ?? rect.left) - 34,
      }
    }

    function refreshVisiblePins() {
      const next: VisiblePin[] = []
      const seen = new Set<string>()

      const candidates = [
        pinnedBlockId ? { blockId: pinnedBlockId, pinned: true } : null,
        focusedBlockId ? { blockId: focusedBlockId, pinned: focusedBlockId === pinnedBlockId } : null,
      ]

      for (const candidate of candidates) {
        if (!candidate || seen.has(candidate.blockId)) continue
        const pos = getPos(candidate.blockId)
        if (!pos) continue

        next.push({
          ...pos,
          pinned: candidate.pinned,
        })
        seen.add(candidate.blockId)
      }

      setVisiblePins(next)
    }

    refreshVisiblePins()
    const unregister = editor.registerUpdateListener(() => {
      refreshVisiblePins()
    })
    window.addEventListener('resize', refreshVisiblePins)

    container.addEventListener('scroll', refreshVisiblePins, { passive: true })

    return () => {
      unregister()
      window.removeEventListener('resize', refreshVisiblePins)
      container.removeEventListener('scroll', refreshVisiblePins)
    }
  }, [editor, focusedBlockId, pinnedBlockId])

  if (visiblePins.length === 0) return null

  return createPortal(
    <>
      {visiblePins.map((pin) => {
        const isPinned = pin.pinned

        return (
          <button
            key={pin.blockId}
            type="button"
            className={`writing-pin-hover${isPinned ? ' is-pinned' : ''}`}
            style={{
              position: 'fixed',
              top: pin.top,
              left: pin.left,
            }}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              if (isPinned) {
                clearWritingPin()
                return
              }

              editor.getEditorState().read(() => {
                const selection = $getSelection()
                const offset = $isRangeSelection(selection) ? selection.anchor.offset : 0

                setWritingPin({
                  scriptId,
                  blockId: pin.blockId,
                  offset,
                  setAt: new Date().toISOString(),
                })
              })
            }}
            title={isPinned ? 'Clear writing pin' : 'Set writing pin'}
            aria-label={isPinned ? 'Clear writing pin' : 'Set writing pin'}
          >
            <PinIcon size={16} />
          </button>
        )
      })}
    </>,
    document.body
  )
}
