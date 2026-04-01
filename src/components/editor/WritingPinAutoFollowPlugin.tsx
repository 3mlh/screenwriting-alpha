'use client'

import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
} from 'lexical'
import { getParentScreenplayBlock } from './blockTypeUtils'
import { $isScreenplayBlockNode } from './nodes/ScreenplayBlockNode'
import { useScriptStore } from '@/stores/scriptStore'

type PendingStructuralAction =
  | {
      kind: 'enter' | 'paste' | 'delete'
      sourceBlockId: string
      previousBlockIds: Set<string>
    }
  | null

function getCurrentBlockIds(): Set<string> {
  const ids = new Set<string>()
  const root = $getRoot()

  for (const child of root.getChildren()) {
    if ($isScreenplayBlockNode(child)) {
      ids.add(child.getBlockId())
    }
  }

  return ids
}

function getCurrentSelectionAnchor() {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return null

  const block = getParentScreenplayBlock(selection.anchor.getNode())
  if (!block) return null

  return {
    blockId: block.getBlockId(),
    offset: selection.anchor.offset,
  }
}

type StructuralActionKind = 'enter' | 'paste' | 'delete'
interface SelectionAnchorValue {
  blockId: string
  offset: number
}

type SelectionAnchor = SelectionAnchorValue | null

export function WritingPinAutoFollowPlugin({
  scriptId,
}: {
  scriptId: string
}): null {
  const [editor] = useLexicalComposerContext()
  const writingPin = useScriptStore((s) => s.writingPin)
  const setWritingPin = useScriptStore((s) => s.setWritingPin)
  const pendingActionRef = useRef<PendingStructuralAction>(null)

  useEffect(() => {
    function captureStructuralAction(kind: StructuralActionKind): boolean {
      if (!writingPin || writingPin.scriptId !== scriptId) return false

      const anchor = getCurrentSelectionAnchor()
      if (!anchor || anchor.blockId !== writingPin.blockId) return false

      pendingActionRef.current = {
        kind,
        sourceBlockId: anchor.blockId,
        previousBlockIds: getCurrentBlockIds(),
      }

      return false
    }

    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => captureStructuralAction('enter'),
      COMMAND_PRIORITY_HIGH
    )

    const unregisterPaste = editor.registerCommand<ClipboardEvent>(
      PASTE_COMMAND,
      () => captureStructuralAction('paste'),
      COMMAND_PRIORITY_HIGH
    )

    const unregisterKeyDown = editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      (event) => {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return false
        return captureStructuralAction('delete')
      },
      COMMAND_PRIORITY_HIGH
    )

    const unregisterUpdate = editor.registerUpdateListener(({ editorState, dirtyElements }) => {
      const pending = pendingActionRef.current
      if (!pending) return

      if (dirtyElements.size === 0) {
        pendingActionRef.current = null
        return
      }

      let nextAnchor: { blockId: string; offset: number } | null = null
      let currentBlockIds = new Set<string>()

      editorState.read(() => {
        nextAnchor = getCurrentSelectionAnchor()
        currentBlockIds = getCurrentBlockIds()
      })

      const target: SelectionAnchor = nextAnchor
      const sourceBlockRemoved = !currentBlockIds.has(pending.sourceBlockId)

      let shouldFollow = false
      if (target !== null) {
        const resolvedTarget = target as SelectionAnchorValue
        const blockChanged = resolvedTarget.blockId !== pending.sourceBlockId

        if (pending.kind === 'enter') {
          shouldFollow =
            blockChanged &&
            !pending.previousBlockIds.has(resolvedTarget.blockId)
        } else if (pending.kind === 'paste') {
          shouldFollow = blockChanged
        } else if (pending.kind === 'delete') {
          shouldFollow = sourceBlockRemoved && blockChanged
        }
      }

      if (shouldFollow && target !== null) {
        const resolvedTarget = target as SelectionAnchorValue
        setWritingPin({
          scriptId,
          blockId: resolvedTarget.blockId,
          offset: resolvedTarget.offset,
          setAt: new Date().toISOString(),
        })
      }

      pendingActionRef.current = null
    })

    return () => {
      unregisterEnter()
      unregisterPaste()
      unregisterKeyDown()
      unregisterUpdate()
    }
  }, [editor, scriptId, setWritingPin, writingPin])

  return null
}
