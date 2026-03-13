'use client'

import { useEffect, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW, $getRoot, $getSelection, $isRangeSelection } from 'lexical'
import type { PresenceUser } from '@/hooks/usePresence'
import { $isScreenplayBlockNode } from './nodes/ScreenplayBlockNode'
import { getParentScreenplayBlock } from './blockTypeUtils'

type Props = {
  presences: PresenceUser[]
  currentUserId: string
  onCursorChange: (cursor: { blockId: string; offset: number } | null) => void
}

const ATTR = 'data-collab-user'

export function CollaborationPlugin({ presences, currentUserId, onCursorChange }: Props) {
  const [editor] = useLexicalComposerContext()

  // Broadcast cursor position (stable block UUID, not ephemeral Lexical key)
  const stableOnCursorChange = useCallback(onCursorChange, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const parentBlock = getParentScreenplayBlock(selection.anchor.getNode())
          if (parentBlock && $isScreenplayBlockNode(parentBlock)) {
            stableOnCursorChange({ blockId: parentBlock.getBlockId(), offset: selection.anchor.offset })
          } else {
            stableOnCursorChange(null)
          }
        } else {
          stableOnCursorChange(null)
        }
        return false
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, stableOnCursorChange])

  // Render colored left-border indicators for other users' cursors
  useEffect(() => {
    const others = presences.filter((p) => p.userId !== currentUserId && p.cursor)

    // Build a blockId → PresenceUser map for fast lookup
    const cursorMap = new Map<string, PresenceUser>()
    for (const user of others) {
      if (user.cursor) cursorMap.set(user.cursor.blockId, user)
    }

    // Clear previous indicators then re-apply
    editor.getEditorState().read(() => {
      const root = $getRoot()
      for (const child of root.getChildren()) {
        if (!$isScreenplayBlockNode(child)) continue
        const dom = editor.getElementByKey(child.getKey()) as HTMLElement | null
        if (!dom) continue

        const blockId = child.getBlockId()
        const user = cursorMap.get(blockId)

        if (user) {
          dom.setAttribute(ATTR, user.userId)
          dom.style.setProperty('--collab-color', user.color)
          dom.style.setProperty('--collab-name', JSON.stringify(user.displayName || user.userId.slice(0, 8)))
        } else if (dom.hasAttribute(ATTR)) {
          dom.removeAttribute(ATTR)
          dom.style.removeProperty('--collab-color')
          dom.style.removeProperty('--collab-name')
        }
      }
    })
  }, [editor, presences, currentUserId])

  return null
}
