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
import { $getRoot, $getSelection, $isRangeSelection } from 'lexical'

import { SCREENPLAY_NODES } from './ScreenplayNodes'
import { BlockTypePlugin } from './BlockTypePlugin'
import { BlockTypeSelectorPlugin } from './BlockTypeSelectorPlugin'
import { lexicalToBlocks } from './serialization/lexicalToBlocks'
import { $loadBlocksIntoEditor } from './serialization/blocksToLexical'
import { $createSceneHeadingNode } from './nodes/SceneHeadingNode'
import { useScriptStore } from '@/stores/scriptStore'
import { DevToolsPlugin } from './DevToolsPlugin'
import { getParentScreenplayBlock } from './blockTypeUtils'
import { $isScreenplayBlockNode } from './nodes/ScreenplayBlockNode'
import type { Block } from '@/types/screenplay'

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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ScreenplayEditorProps {
  initialBlocks?: Block[]
  readOnly?: boolean
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function ScreenplayEditor({
  initialBlocks,
  readOnly = false,
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
        {!readOnly && <ActiveScenePlugin />}
        {process.env.NODE_ENV !== 'production' && <DevToolsPlugin />}
      </LexicalComposer>
    </div>
  )
}
