'use client'

// ─── Block Type Plugin ────────────────────────────────────────────────────────
//
// Handles Enter and Tab key behavior.
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
//
//   TAB key — cycles the current block through the main screenplay types:
//     scene_heading → action → character → dialogue → parenthetical
//     → transition → shot → scene_heading → …

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical'
import {
  getParentScreenplayBlock,
  appendNewBlock,
  splitBlock,
  replaceWithType,
} from './blockTypeUtils'
import type { BlockType } from '@/types/screenplay'

// Ordered cycle used by Tab key. Excludes structural/annotation types.
const TAB_CYCLE: BlockType[] = [
  'scene_heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
]

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

    const unregisterTab = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event: KeyboardEvent) => {
        event.preventDefault()

        editor.update(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return

          const anchorNode = selection.anchor.getNode()
          const blockNode = getParentScreenplayBlock(anchorNode)
          if (!blockNode) return

          const currentType = blockNode.getBlockType()
          const idx = TAB_CYCLE.indexOf(currentType)
          const nextType = idx === -1
            ? TAB_CYCLE[0]
            : TAB_CYCLE[(idx + (event.shiftKey ? TAB_CYCLE.length - 1 : 1)) % TAB_CYCLE.length]

          replaceWithType(blockNode, nextType)
        })

        return true
      },
      COMMAND_PRIORITY_NORMAL
    )

    return () => {
      unregisterEnter()
      unregisterTab()
    }
  }, [editor])

  return null
}
