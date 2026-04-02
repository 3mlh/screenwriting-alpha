'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection } from 'lexical'
import {
  getParentScreenplayBlock,
  replaceWithDisplayType,
  getDisplayBlockType,
  DISPLAY_BLOCK_TYPES,
  DISPLAY_BLOCK_TYPE_LABELS,
} from './blockTypeUtils'
import type { DisplayBlockType } from './blockTypeUtils'
import { useScriptStore } from '@/stores/scriptStore'

function SaveStatusBadge(): React.ReactElement | null {
  const autosaveStatus = useScriptStore((s) => s.autosaveStatus)
  const isDirty = useScriptStore((s) => s.isDirty)

  let tone: 'saving' | 'error' | 'unsaved' | null = null
  let label = ''

  if (autosaveStatus === 'saving') {
    tone = 'saving'
    label = 'Saving'
  } else if (autosaveStatus === 'error') {
    tone = 'error'
    label = 'Save failed'
  } else if (isDirty) {
    tone = 'unsaved'
    label = 'Unsaved'
  }

  if (!tone) return null

  return (
    <div className={`block-type-selector-save-indicator is-${tone}`} aria-live="polite">
      <span className="block-type-selector-save-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function BlockTypeSelectorPlugin(): React.ReactElement {
  const [editor] = useLexicalComposerContext()
  const [currentType, setCurrentType] = useState<DisplayBlockType | null>(null)

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) {
          setCurrentType(null)
          return
        }
        const node = getParentScreenplayBlock(selection.anchor.getNode())
        setCurrentType(node ? getDisplayBlockType(node) : null)
      })
    })
  }, [editor])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value as DisplayBlockType
      editor.update(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return
        const node = getParentScreenplayBlock(selection.anchor.getNode())
        if (!node) return
        replaceWithDisplayType(node, newType)
      })
      editor.focus()
    },
    [editor]
  )

  return (
    <div className="block-type-selector-bar">
      <label className="block-type-selector-label" htmlFor="block-type-select">
        Block
      </label>
      <select
        id="block-type-select"
        className="block-type-selector-select"
        value={currentType ?? ''}
        onChange={handleChange}
        disabled={currentType === null}
      >
        {currentType === null && (
          <option value="" disabled>—</option>
        )}
        {DISPLAY_BLOCK_TYPES.map((type) => (
          <option key={type} value={type}>
            {DISPLAY_BLOCK_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <SaveStatusBadge />
    </div>
  )
}
