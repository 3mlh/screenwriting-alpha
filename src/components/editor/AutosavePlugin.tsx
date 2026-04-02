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
// Autosave snapshot cadence:
//   Sends lastSnapshotAt (from localStorage) with each save. If the server
//   creates an autosave snapshot (>30min since last), it returns snapshotId
//   which we persist to localStorage so the next save has fresh timing.
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
const LAST_SNAPSHOT_KEY = (scriptId: string) => `lastSnapshotAt:${scriptId}`

function isInternalNavigationTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false

  const link = target.closest('a[href]')
  if (!(link instanceof HTMLAnchorElement)) return false
  if (link.target && link.target !== '_self') return false
  if (link.hasAttribute('download')) return false

  const href = link.getAttribute('href')
  if (!href || href.startsWith('#')) return false

  try {
    const url = new URL(link.href, window.location.href)
    return url.origin === window.location.origin
  } catch {
    return false
  }
}

export function AutosavePlugin({ scriptId }: { scriptId: string }): null {
  const [editor] = useLexicalComposerContext()
  const blocksRef = useRef(useScriptStore.getState().blocks)
  const isDirtyRef = useRef(useScriptStore.getState().isDirty)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)

  const setAutosaveStatus = useScriptStore((s) => s.setAutosaveStatus)
  const setEditorDirty = useScriptStore((s) => s.setEditorDirty)
  const setLastOwnSavedAt = useScriptStore((s) => s.setLastOwnSavedAt)

  // Keep a live ref to the latest blocks without re-subscribing
  useEffect(() => {
    return useScriptStore.subscribe((state) => {
      blocksRef.current = state.blocks
      isDirtyRef.current = state.isDirty
    })
  }, [])

  const save = useCallback(async (options?: { keepalive?: boolean }) => {
    if (isSavingRef.current) return
    if (!isDirtyRef.current) return

    const blocks = blocksRef.current
    isSavingRef.current = true
    setAutosaveStatus('saving')

    try {
      const lastSnapshotAt = localStorage.getItem(LAST_SNAPSHOT_KEY(scriptId)) ?? null

      const res = await fetch(`/api/scripts/${scriptId}/blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        keepalive: options?.keepalive,
        body: JSON.stringify({ blocks, lastSnapshotAt }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Autosave failed:', err)
        setAutosaveStatus('error')
        return
      }

      const data = await res.json().catch(() => ({}))
      const typed = data as { savedAt?: string; snapshotId?: string }
      setLastOwnSavedAt(typed.savedAt ?? null)

      // Server created a new autosave snapshot — record the time so we don't
      // snapshot again for another 30 minutes.
      if (typed.snapshotId) {
        localStorage.setItem(LAST_SNAPSHOT_KEY(scriptId), new Date().toISOString())
      }

      setEditorDirty(false)
      setAutosaveStatus('saved')
    } catch (err) {
      console.error('Autosave network error:', err)
      setAutosaveStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }, [scriptId, setAutosaveStatus, setEditorDirty, setLastOwnSavedAt])

  const flushPendingSave = useCallback((options?: { keepalive?: boolean }) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    void save(options)
  }, [save])

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
      if (isDirtyRef.current) {
        flushPendingSave({ keepalive: true })
      } else if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [flushPendingSave, scheduleDebounce])

  // Cmd+S / Ctrl+S — bypass debounce
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        flushPendingSave()
      }
    }

    // Register on the root element so we capture it even if the editor isn't focused
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [flushPendingSave])

  // Save on window blur (user navigates away)
  useEffect(() => {
    function handleBlur() {
      if (isDirtyRef.current) {
        flushPendingSave({ keepalive: true })
      }
    }

    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [flushPendingSave])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && isDirtyRef.current) {
        flushPendingSave({ keepalive: true })
      }
    }

    function handlePageHide() {
      if (isDirtyRef.current) {
        flushPendingSave({ keepalive: true })
      }
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!isDirtyRef.current) return
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!isInternalNavigationTarget(event.target)) return

      flushPendingSave()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [flushPendingSave])

  // editor is used to satisfy React's exhaustive-deps; it doesn't need to trigger effects
  void editor

  return null
}
