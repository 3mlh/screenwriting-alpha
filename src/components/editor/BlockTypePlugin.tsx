'use client'

// ─── Block Type Plugin ────────────────────────────────────────────────────────
//
// Handles only Enter key behavior. Block type changes are done via the
// BlockTypeSelectorPlugin dropdown, not Tab.
//
//   ENTER key — creates the next block with the contextually appropriate type:
//     scene_heading  → action
//     action         → action
//     character      → dialogue
//     dialogue       → character
//     parenthetical  → dialogue
//     transition     → scene_heading
//     shot           → action
//     section        → action
//     summary        → action
//     cold_open_marker → scene_heading
//
//   Shift+ENTER in dialogue → action  (exit dialogue block entirely)

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  KEY_ENTER_COMMAND,
} from 'lexical'
import {
  getParentScreenplayBlock,
  appendNewBlock,
  splitBlock,
} from './blockTypeUtils'
import type { BlockType } from '@/types/screenplay'

const ENTER_NEXT_TYPE: Record<BlockType, BlockType> = {
  scene_heading:     'action',
  action:            'action',
  character:         'dialogue',
  dialogue:          'character',
  parenthetical:     'dialogue',
  transition:        'scene_heading',
  shot:              'action',
  section:           'action',
  summary:           'action',
  cold_open_marker:  'scene_heading',
}

export function BlockTypePlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        event.preventDefault()

        editor.update(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return

          const anchorNode = selection.anchor.getNode()
          const blockNode = getParentScreenplayBlock(anchorNode)
          if (!blockNode) return

          const currentType = blockNode.getBlockType()
          const nextType =
            event.shiftKey && currentType === 'dialogue'
              ? 'action'
              : ENTER_NEXT_TYPE[currentType]

          const anchorOffset = selection.anchor.offset
          const fullText = blockNode.getTextContent()

          if (anchorOffset < fullText.length) {
            splitBlock(blockNode, anchorOffset, nextType)
          } else {
            appendNewBlock(blockNode, nextType)
          }
        })

        return true
      },
      COMMAND_PRIORITY_NORMAL
    )

    return () => { unregisterEnter() }
  }, [editor])

  return null
}
