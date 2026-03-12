'use client'

// ─── Auto Block Type Plugin ───────────────────────────────────────────────────
//
// Watches editor state and automatically converts block types based on text
// patterns the user types, without requiring a manual block-type selection.
//
// Rules:
//   1. Text starts with INT., EXT., or INT/EXT. (case-insensitive)
//      → convert to scene_heading (if not already)
//
//   2. Text starts with "(" AND previous sibling is character or parenthetical
//      → convert to parenthetical (if not already)

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection } from 'lexical'
import {
  getParentScreenplayBlock,
  replaceWithType,
} from './blockTypeUtils'
import { $isScreenplayBlockNode } from './nodes/ScreenplayBlockNode'

const SCENE_HEADING_RE = /^(INT\/EXT|EXT\/INT|INT|EXT)\./i

export function AutoBlockTypePlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return

        const anchorNode = selection.anchor.getNode()
        const blockNode = getParentScreenplayBlock(anchorNode)
        if (!blockNode) return

        const text = blockNode.getTextContent()
        const currentType = blockNode.getBlockType()

        // Rule 1: INT./EXT. → scene_heading
        if (SCENE_HEADING_RE.test(text) && currentType !== 'scene_heading') {
          editor.update(() => {
            const sel = $getSelection()
            if (!$isRangeSelection(sel)) return
            const node = getParentScreenplayBlock(sel.anchor.getNode())
            if (!node) return
            replaceWithType(node, 'scene_heading')
          })
          return
        }

        // Rule 2: "(" at start + previous sibling is character/parenthetical → parenthetical
        if (
          text.startsWith('(') &&
          currentType !== 'parenthetical' &&
          (currentType === 'dialogue' || currentType === 'action')
        ) {
          const prev = blockNode.getPreviousSibling()
          if (
            prev &&
            $isScreenplayBlockNode(prev) &&
            (prev.getBlockType() === 'character' || prev.getBlockType() === 'parenthetical')
          ) {
            editor.update(() => {
              const sel = $getSelection()
              if (!$isRangeSelection(sel)) return
              const node = getParentScreenplayBlock(sel.anchor.getNode())
              if (!node) return
              replaceWithType(node, 'parenthetical')
            })
          }
        }
      })
    })
  }, [editor])

  return null
}
