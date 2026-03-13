'use client'

import { useCallback, useEffect } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { EditorState, LexicalNode } from 'lexical'
import { COMMAND_PRIORITY_HIGH, PASTE_COMMAND, $createTextNode, $getRoot, $getSelection, $isRangeSelection } from 'lexical'

import { SCREENPLAY_NODES } from './ScreenplayNodes'
import { $createActionNode } from './nodes/ActionNode'
import { BlockTypePlugin } from './BlockTypePlugin'
import { AutoBlockTypePlugin } from './AutoBlockTypePlugin'
import { BlockTypeSelectorPlugin } from './BlockTypeSelectorPlugin'
import { AutosavePlugin } from './AutosavePlugin'
import { CollaborationPlugin } from './CollaborationPlugin'
import { lexicalToBlocks } from './serialization/lexicalToBlocks'
import { $loadBlocksIntoEditor } from './serialization/blocksToLexical'
import { $createSceneHeadingNode } from './nodes/SceneHeadingNode'
import { useScriptStore } from '@/stores/scriptStore'
import { DevToolsPlugin } from './DevToolsPlugin'
import { getParentScreenplayBlock } from './blockTypeUtils'
import { $isScreenplayBlockNode } from './nodes/ScreenplayBlockNode'
import type { Block } from '@/types/screenplay'
import type { PresenceUser } from '@/hooks/usePresence'

// ─── Paste normalizer ─────────────────────────────────────────────────────────
//
// Intercepts PASTE_COMMAND before Lexical's default handler. For external
// content (anything without the Lexical JSON mime type), reads plain text,
// splits on newlines, and inserts each non-empty line as a new ActionNode.
// Within-editor copy-paste (application/x-lexical-editor) is passed through
// so Lexical's importJSON round-trip preserves existing block types.

function PasteNormalizerPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand<ClipboardEvent>(
      PASTE_COMMAND,
      (event) => {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false

        // Pass through within-editor pastes so block types are preserved
        if (clipboardData.getData('application/x-lexical-editor')) return false

        const text = clipboardData.getData('text/plain')
        if (!text) return false

        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length === 0) return false

        editor.update(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return

          const anchorNode = selection.anchor.getNode()
          const currentBlock = getParentScreenplayBlock(anchorNode)
          if (!currentBlock) return

          // Replace current block's content with the first pasted line
          currentBlock.clear()
          currentBlock.append($createTextNode(lines[0]))

          // Each remaining line becomes a new ActionNode inserted after the previous
          let insertAfter = currentBlock as ReturnType<typeof getParentScreenplayBlock>
          for (const line of lines.slice(1)) {
            const node = $createActionNode()
            node.append($createTextNode(line))
            insertAfter!.insertAfter(node)
            insertAfter = node
          }

          insertAfter!.selectEnd()
        })

        return true // Consume event — skip Lexical's default HTML paste
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor])

  return null
}

// ─── Initial state plugin ─────────────────────────────────────────────────────

function InitialStatePlugin({ initialBlocks }: { initialBlocks?: Block[] }): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editor.update(() => {
      if (initialBlocks && initialBlocks.length > 0) {
        $loadBlocksIntoEditor(initialBlocks)
      } else {
        const root = $getRoot()
        if (root.isEmpty()) {
          const heading = $createSceneHeadingNode()
          root.append(heading)
          heading.select()
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

// ─── Realtime block loader ────────────────────────────────────────────────────
//
// Watches the store for blocks pushed by a peer's save. When detected, loads
// them into the editor and resets the dirty flag.

function RealtimeBlockLoaderPlugin(): null {
  const [editor] = useLexicalComposerContext()
  const pendingExternalBlocks = useScriptStore((s) => s.pendingExternalBlocks)
  const setPendingExternalBlocks = useScriptStore((s) => s.setPendingExternalBlocks)
  const setEditorDirty = useScriptStore((s) => s.setEditorDirty)

  useEffect(() => {
    if (!pendingExternalBlocks) return
    const blocks = pendingExternalBlocks
    // Clear immediately so this effect doesn't re-run
    setPendingExternalBlocks(null)
    // Load into editor synchronously so onChange fires inside the same microtask
    editor.update(
      () => { $loadBlocksIntoEditor(blocks) },
      { discrete: true }
    )
    // Reset dirty: this runs after the discrete update (and its onChange) complete
    setEditorDirty(false)
  }, [editor, pendingExternalBlocks, setPendingExternalBlocks, setEditorDirty])

  return null
}

// ─── Active scene tracker ─────────────────────────────────────────────────────
//
// Walks Lexical siblings backward from the focused block to find the nearest
// scene_heading, then updates the store so the outline panel can highlight it.

function ActiveScenePlugin(): null {
  const [editor] = useLexicalComposerContext()
  const setActiveSceneId = useScriptStore((s) => s.setActiveSceneId)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          setActiveSceneId(null)
          return
        }
        let node: LexicalNode | null = getParentScreenplayBlock(
          selection.anchor.getNode()
        )
        while (node) {
          if ($isScreenplayBlockNode(node) && node.getBlockType() === 'scene_heading') {
            setActiveSceneId(node.getBlockId())
            return
          }
          node = node.getPreviousSibling()
        }
        setActiveSceneId(null)
      })
    })
  }, [editor, setActiveSceneId])

  return null
}

// ─── Focused block tracker ────────────────────────────────────────────────────
//
// Adds data-focused="true" to the DOM element of the block that currently holds
// the cursor, and clears it from all others. Ghost text CSS is scoped to
// [data-focused="true"] so only the active empty block shows a hint.

function FocusedBlockPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      let focusedKey: string | null = null
      const allKeys: string[] = []

      editorState.read(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const node = getParentScreenplayBlock(selection.anchor.getNode())
          if (node) focusedKey = node.getKey()
        }
        const root = $getRoot()
        for (const child of root.getChildren()) {
          if ($isScreenplayBlockNode(child)) allKeys.push(child.getKey())
        }
      })

      for (const key of allKeys) {
        const dom = editor.getElementByKey(key) as HTMLElement | null
        if (!dom) continue
        if (key === focusedKey) {
          dom.dataset.focused = 'true'
        } else {
          delete dom.dataset.focused
        }
      }
    })
  }, [editor])

  return null
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CollaborationProps {
  presences: PresenceUser[]
  currentUserId: string
  onCursorChange: (cursor: { blockId: string; offset: number } | null) => void
}

export interface ScreenplayEditorProps {
  initialBlocks?: Block[]
  readOnly?: boolean
  // When provided, AutosavePlugin is mounted and saves blocks to this script ID.
  // Omit for the M1 demo editor (no backend).
  scriptId?: string
  // When provided, enables real-time cursor tracking and presence indicators.
  collaboration?: CollaborationProps
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function ScreenplayEditor({
  initialBlocks,
  readOnly = false,
  scriptId,
  collaboration,
}: ScreenplayEditorProps): React.ReactElement {
  const setBlocks = useScriptStore((s) => s.setBlocks)
  const setEditorDirty = useScriptStore((s) => s.setEditorDirty)

  // Pre-populate the store immediately so the outline panel has data before
  // OnChangePlugin fires its first update after the Lexical round-trip.
  useEffect(() => {
    if (initialBlocks && initialBlocks.length > 0) {
      setBlocks(initialBlocks)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChange = useCallback(
    (editorState: EditorState) => {
      const blocks = lexicalToBlocks(editorState)
      setBlocks(blocks)
      setEditorDirty(true)
    },
    [setBlocks, setEditorDirty]
  )

  const initialConfig = {
    namespace: 'ScreenplayEditor',
    nodes: SCREENPLAY_NODES,
    editable: !readOnly,
    onError: (error: Error) => {
      console.error('Lexical editor error:', error)
    },
    editorState: null,
  }

  return (
    <div className="screenplay-editor-shell">
      <LexicalComposer initialConfig={initialConfig}>
        {/* Block type selector — inside LexicalComposer so it can read selection */}
        {!readOnly && <BlockTypeSelectorPlugin />}

        <div className="screenplay-page-container">
          <div className="screenplay-page">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="screenplay-content-editable"
                  aria-label="Screenplay editor"
                  spellCheck
                />
              }
              placeholder={
                <div className="screenplay-placeholder">
                  INT. / EXT. — Begin your screenplay...
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>

        <HistoryPlugin />
        <OnChangePlugin onChange={onChange} ignoreSelectionChange />
        <InitialStatePlugin initialBlocks={initialBlocks} />
        {!readOnly && <BlockTypePlugin />}
        {!readOnly && <AutoBlockTypePlugin />}
        {!readOnly && <PasteNormalizerPlugin />}
        {!readOnly && <ActiveScenePlugin />}
        <FocusedBlockPlugin />
        {!readOnly && scriptId && <AutosavePlugin scriptId={scriptId} />}
        {!readOnly && collaboration && (
          <CollaborationPlugin
            presences={collaboration.presences}
            currentUserId={collaboration.currentUserId}
            onCursorChange={collaboration.onCursorChange}
          />
        )}
        {!readOnly && <RealtimeBlockLoaderPlugin />}
        {process.env.NODE_ENV !== 'production' && <DevToolsPlugin />}
      </LexicalComposer>
    </div>
  )
}
