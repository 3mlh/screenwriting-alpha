'use client'

// ─── DevTools Plugin ──────────────────────────────────────────────────────────
//
// In development, exposes the current Block[] on window for console inspection.
// This satisfies acceptance criterion #5: "Call lexicalToBlocks() in the
// browser console — the result is a valid Block[]".
//
// Usage:
//   window.__getBlocks()        → Block[] (current editor state)
//   window.__validateBlocks()   → { success, data/error }

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { lexicalToBlocks } from './serialization/lexicalToBlocks'
import { safeValidateBlocks } from '@/lib/validation/block.schema'
import type { Block } from '@/types/screenplay'

declare global {
  interface Window {
    __getBlocks: () => Block[]
    __validateBlocks: () => ReturnType<typeof safeValidateBlocks>
  }
}

export function DevToolsPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'production') return

    window.__getBlocks = () => {
      return lexicalToBlocks(editor.getEditorState())
    }

    window.__validateBlocks = () => {
      const blocks = window.__getBlocks()
      return safeValidateBlocks(blocks)
    }

    console.info(
      '[Screenwriting] DevTools ready.\n' +
      '  window.__getBlocks()       → current Block[]\n' +
      '  window.__validateBlocks()  → Zod validation result'
    )

    return () => {
      // @ts-expect-error — cleanup
      delete window.__getBlocks
      // @ts-expect-error — cleanup
      delete window.__validateBlocks
    }
  }, [editor])

  return null
}
