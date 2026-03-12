'use client'

// ── AutosavePlugin ─────────────────────────────────────────────────────────────
//
// Lexical plugin that watches the Zustand store's isDirty flag and debounces
// a PUT /api/scripts/[id]/blocks call when the editor content changes.
//
// Also registers a keydown listener for Cmd+S / Ctrl+S to save immediately.
//
// The plugin is mounted inside LexicalComposer so it has access to the editor
// context, but it does NOT use Lexical state for the save payload — it reads
// the canonical Block[] from the Zustand store instead.
//
// Lifecycle:
//   - On mount: register Cmd+S keydown listener
//   - On isDirty: start 2s debounce timer
//   - On timer fire / Cmd+S: PUT blocks, set autosaveStatus
//   - On unmount: flush any pending save

import { useEffect, useRef, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useScriptStore } from '@/stores/scriptStore'

const DEBOUNCE_MS = 2000

export function AutosavePlugin({ scriptId }: { scriptId: string }): null {
  const [editor] = useLexicalComposerContext()
  const blocksRef = useRef(useScriptStore.getState().blocks)
  const isDirtyRef = useRef(useScriptStore.getState().isDirty)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)

  const setAutosaveStatus = useScriptStore((s) => s.setAutosaveStatus)
  const setEditorDirty = useScriptStore((s) => s.setEditorDirty)

  // Keep a live ref to the latest blocks without re-subscribing
  useEffect(() => {
    return useScriptStore.subscribe((state) => {
      blocksRef.current = state.blocks
      isDirtyRef.current = state.isDirty
    })
  }, [])

  const save = useCallback(async () => {
    if (isSavingRef.current) return
    if (!isDirtyRef.current) return

    const blocks = blocksRef.current
    isSavingRef.current = true
    setAutosaveStatus('saving')

    try {
      const res = await fetch(`/api/scripts/${scriptId}/blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Autosave failed:', err)
        setAutosaveStatus('error')
        return
      }

      setEditorDirty(false)
      setAutosaveStatus('saved')
    } catch (err) {
      console.error('Autosave network error:', err)
      setAutosaveStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }, [scriptId, setAutosaveStatus, setEditorDirty])

  const scheduleDebounce = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(save, DEBOUNCE_MS)
  }, [save])

  // Subscribe to isDirty changes in the store and debounce saves
  useEffect(() => {
    const unsub = useScriptStore.subscribe((state, prev) => {
      if (state.isDirty && state.isDirty !== prev.isDirty) {
        scheduleDebounce()
      }
    })
    return () => {
      unsub()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [scheduleDebounce])

  // Cmd+S / Ctrl+S — bypass debounce
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        save()
      }
    }

    // Register on the root element so we capture it even if the editor isn't focused
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [save])

  // Save on window blur (user navigates away)
  useEffect(() => {
    function handleBlur() {
      if (isDirtyRef.current) {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        save()
      }
    }

    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [save])

  // editor is used to satisfy React's exhaustive-deps; it doesn't need to trigger effects
  void editor

  return null
}
