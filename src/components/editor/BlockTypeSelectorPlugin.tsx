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
    </div>
  )
}
