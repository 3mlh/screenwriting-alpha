'use client'

import { useCallback, useEffect } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { EditorState } from 'lexical'
import { $getRoot } from 'lexical'

import { SCREENPLAY_NODES } from './ScreenplayNodes'
import { BlockTypePlugin } from './BlockTypePlugin'
import { BlockTypeSelectorPlugin } from './BlockTypeSelectorPlugin'
import { lexicalToBlocks } from './serialization/lexicalToBlocks'
import { $loadBlocksIntoEditor } from './serialization/blocksToLexical'
import { $createSceneHeadingNode } from './nodes/SceneHeadingNode'
import { useScriptStore } from '@/stores/scriptStore'
import { DevToolsPlugin } from './DevToolsPlugin'
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
        {process.env.NODE_ENV !== 'production' && <DevToolsPlugin />}
      </LexicalComposer>
    </div>
  )
}
