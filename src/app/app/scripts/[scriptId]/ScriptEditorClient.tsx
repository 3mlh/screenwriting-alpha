'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ScreenplayEditor } from '@/components/editor/ScreenplayEditor'
import { OutlinePanel } from '@/components/outline/OutlinePanel'
import { SaveIndicator } from '@/components/ui/SaveIndicator'
import { Dialog } from '@/components/ui/Dialog'
import { ShareDialog } from '@/components/ui/ShareDialog'
import { PresenceAvatars } from '@/components/ui/PresenceAvatars'
import { RevisionPanel } from '@/components/ui/RevisionPanel'
import { ScriptSearchControl } from '@/components/ui/ScriptSearchControl'
import { PinIcon } from '@/components/ui/icons/PinIcon'
import { useScriptStore } from '@/stores/scriptStore'
import { usePresence } from '@/hooks/usePresence'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { scrollToBlock } from '@/lib/editor/scrollToBlock'
import type { Script, PermissionLevel, Block } from '@/types/screenplay'

interface Props {
  script: Script
  userId: string
  displayName: string
  readOnly?: boolean
  currentUserRole?: PermissionLevel
}

export function ScriptEditorClient({
  script,
  userId,
  displayName,
  readOnly = false,
  currentUserRole = 'viewer',
}: Props) {
  const isDirty = useScriptStore((s) => s.isDirty)
  const autosaveStatus = useScriptStore((s) => s.autosaveStatus)
  const setScript = useScriptStore((s) => s.setScript)
  const setLastCursorAnchor = useScriptStore((s) => s.setLastCursorAnchor)
  const setJumpHighlightBlockId = useScriptStore((s) => s.setJumpHighlightBlockId)
  const setPendingCursorRestore = useScriptStore((s) => s.setPendingCursorRestore)
  const setPendingCursorRestorePlacement = useScriptStore((s) => s.setPendingCursorRestorePlacement)
  const setPendingExternalBlocks = useScriptStore((s) => s.setPendingExternalBlocks)
  const hydrateWritingPin = useScriptStore((s) => s.hydrateWritingPin)
  const writingPin = useScriptStore((s) => s.writingPin)

  const [outlineOpen, setOutlineOpen] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [staleData, setStaleData] = useState(false)
  const [confirmReturnOpen, setConfirmReturnOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const revisionPanelOpen = useScriptStore((s) => s.revisionPanelOpen)
  const setRevisionPanelOpen = useScriptStore((s) => s.setRevisionPanelOpen)
  const activeRevisionSet = useScriptStore((s) => s.activeRevisionSet)

  // Register the script in the store so AutosavePlugin can read the scriptId
  useEffect(() => {
    setScript(script)
  }, [script, setScript])

  useEffect(() => {
    return () => setScript(null)
  }, [setScript])

  useEffect(() => {
    hydrateWritingPin()
  }, [hydrateWritingPin])

  // Presence + cursor tracking
  const { presences, broadcastCursor } = usePresence(script.id, {
    userId,
    displayName,
  })

  // Stable cursor change handler to pass into the editor
  const handleCursorChange = useCallback(
    (cursor: { blockId: string; offset: number } | null) => {
      broadcastCursor(cursor)
      if (cursor) setLastCursorAnchor(cursor)
    },
    [broadcastCursor, setLastCursorAnchor]
  )

  // Real-time block updates from other users.
  // Only subscribe when there are other members — a solo user's own autosaves
  // would otherwise trigger the reload and wipe in-flight edits.
  const hasPeers = script.memberCount > 1 || script.projectMemberCount > 1
  useEffect(() => {
    if (readOnly || !hasPeers) return
    const supabase = getSupabaseBrowserClient()
    const channel = supabase
      .channel(`blocks:script:${script.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scripts',
          filter: `id=eq.${script.id}`,
        },
        (payload) => {
          // Skip our own saves. Two checks needed because of a race condition:
          // the Realtime event can arrive either before or after the API response.
          // 1. 'saving' status: event arrived before response (common — WebSocket is faster than HTTP)
          // 2. lastOwnSavedAt match: event arrived after response
          const state = useScriptStore.getState()
          if (state.autosaveStatus === 'saving') return
          const incomingAt = (payload.new as { updated_at?: string }).updated_at
          if (incomingAt && state.lastOwnSavedAt &&
              new Date(incomingAt).getTime() === new Date(state.lastOwnSavedAt).getTime()) return
          const blocks = (payload.new as { blocks?: Block[] }).blocks
          if (Array.isArray(blocks)) {
            setPendingExternalBlocks(blocks)
            setStaleData(false) // We just got the fresh data
          } else {
            setStaleData(true)
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [script.id, userId, readOnly, hasPeers, setPendingExternalBlocks])

  useEffect(() => {
    const focusBlockId = searchParams.get('focusBlock')
    const restoreCursorBlock = searchParams.get('restoreCursorBlock')
    const restoreCursorOffset = Number(searchParams.get('restoreCursorOffset') ?? '0')
    if (!focusBlockId && !restoreCursorBlock) return

    if (focusBlockId) {
      setJumpHighlightBlockId(focusBlockId)
    } else if (restoreCursorBlock) {
      setJumpHighlightBlockId(null)
    }

    if (restoreCursorBlock) {
      setPendingCursorRestore({
        blockId: restoreCursorBlock,
        offset: Number.isFinite(restoreCursorOffset) ? restoreCursorOffset : 0,
      })
      setPendingCursorRestorePlacement('center-if-needed')
    }

    let cancelled = false
    let attempts = 0
    const targetBlockId = focusBlockId

    const tryScroll = () => {
      if (cancelled || !targetBlockId) return
      if (scrollToBlock(targetBlockId, { placement: 'search-result' })) return
      attempts += 1
      if (attempts < 20) {
        window.setTimeout(tryScroll, 120)
      }
    }

    const timer = targetBlockId ? window.setTimeout(tryScroll, 80) : null

    const params = new URLSearchParams(searchParams.toString())
    params.delete('focusBlock')
    params.delete('restoreCursorBlock')
    params.delete('restoreCursorOffset')
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })

    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [
    pathname,
    router,
    searchParams,
    setJumpHighlightBlockId,
    setPendingCursorRestore,
    setPendingCursorRestorePlacement,
  ])

  const handleReturnToWriting = useCallback(() => {
    if (!writingPin) return

    const target = new URLSearchParams()
    target.set('restoreCursorBlock', writingPin.blockId)
    target.set('restoreCursorOffset', String(writingPin.offset))

    const href = `/app/scripts/${writingPin.scriptId}?${target.toString()}`

    if (writingPin.scriptId === script.id) {
      router.replace(href, { scroll: false })
      return
    }

    setConfirmReturnOpen(true)
  }, [router, script.id, writingPin])

  const confirmReturnToWriting = useCallback(() => {
    if (!writingPin || writingPin.scriptId === script.id) {
      setConfirmReturnOpen(false)
      return
    }

    const target = new URLSearchParams()
    target.set('restoreCursorBlock', writingPin.blockId)
    target.set('restoreCursorOffset', String(writingPin.offset))
    setConfirmReturnOpen(false)
    router.push(`/app/scripts/${writingPin.scriptId}?${target.toString()}`)
  }, [router, script.id, writingPin])

  return (
    <div className="editor-root">
      {/* ── Stale data banner ────────────────────────────────────────────────── */}
      {staleData && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
          <span>This script was updated by another user.</span>
          <button
            onClick={() => window.location.reload()}
            className="font-medium underline underline-offset-2 hover:text-amber-900"
          >
            Reload to see latest changes
          </button>
        </div>
      )}

      {/* ── Top toolbar ────────────────────────────────────────────────────── */}
      <header className="editor-toolbar">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-6 h-6 rounded-md bg-amber-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">W</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Writer&apos;s Room</span>
          </Link>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1.5 min-w-0">
            {(script.memberCount > 1 || script.projectMemberCount > 1) ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-amber-600" aria-label="Shared">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-gray-400" aria-label="Private">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            )}
            <span className="text-sm text-gray-500 truncate max-w-xs">{script.title}</span>
          </span>

          {/* Revision tag — shows active revision name, click opens revision panel */}
          {activeRevisionSet && (
            <button
              onClick={() => { setRevisionPanelOpen(true); setOutlineOpen(false) }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-stone-200 hover:bg-stone-50 transition-colors flex-shrink-0"
              title="Open revisions panel"
            >
              {activeRevisionSet.color && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: activeRevisionSet.color }}
                />
              )}
              <span className="text-[11px] text-gray-500">{activeRevisionSet.name}</span>
            </button>
          )}

          {readOnly && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
              Read only
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <ScriptSearchControl
            projectId={script.projectId}
            currentScriptId={script.id}
          />

          <button
            type="button"
            disabled={!writingPin}
            onClick={handleReturnToWriting}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              writingPin
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-stone-200 bg-stone-50 text-stone-400 opacity-70 cursor-not-allowed'
            }`}
            title={writingPin ? 'Return to writing' : 'Set a writing pin to enable'}
          >
            <PinIcon size={16} />
            Return to writing
          </button>

          {/* Presence avatars */}
          <PresenceAvatars presences={presences} currentUserId={userId} />

          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        </div>
      </header>

      {/* ── Content area ───────────────────────────────────────────────────── */}
      <div className="editor-content">
        {/* Left rail */}
        <div className="editor-left-rail">
          <button
            className={`editor-rail-btn${outlineOpen ? ' active' : ''}`}
            onClick={() => {
              setOutlineOpen((o) => !o)
              setRevisionPanelOpen(false)
            }}
            aria-label={outlineOpen ? 'Hide outline' : 'Show outline'}
            title={outlineOpen ? 'Hide outline' : 'Show outline'}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="3" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="1" y="11.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>
          <button
            className={`editor-rail-btn${revisionPanelOpen ? ' active' : ''}`}
            onClick={() => {
              setRevisionPanelOpen(!revisionPanelOpen)
              if (!revisionPanelOpen) setOutlineOpen(false)
            }}
            aria-label={revisionPanelOpen ? 'Hide revisions' : 'Show revisions'}
            title={revisionPanelOpen ? 'Hide revisions' : 'Show revisions'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        <aside className={`editor-outline-sidebar${outlineOpen && !revisionPanelOpen ? '' : ' collapsed'}`}>
          <div className="outline-sidebar-header">
            <span className="outline-sidebar-title">Outline</span>
          </div>
          <div className="outline-sidebar-body">
            <OutlinePanel />
          </div>
        </aside>

        <aside className={`editor-outline-sidebar${revisionPanelOpen ? '' : ' collapsed'}`}>
          <div className="outline-sidebar-header">
            <span className="outline-sidebar-title">Revisions</span>
          </div>
          <div className="outline-sidebar-body p-0">
            <RevisionPanel
              scriptId={script.id}
              currentUserRole={currentUserRole}
              initialRevisionSetId={script.currentRevisionSetId}
            />
          </div>
        </aside>

        <main className="editor-main">
          <ScreenplayEditor
            initialBlocks={script.blocks}
            scriptId={readOnly ? undefined : script.id}
            readOnly={readOnly}
            collaboration={
              readOnly
                ? undefined
                : {
                    presences,
                    currentUserId: userId,
                    onCursorChange: handleCursorChange,
                  }
            }
          />
        </main>
      </div>

      <Dialog open={confirmReturnOpen} onClose={() => setConfirmReturnOpen(false)}>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-800">
              <PinIcon size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900">Return to writing?</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                This will open another script and move your cursor back to the writing pin.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmReturnOpen(false)}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-stone-50 hover:text-gray-900"
            >
              Stay here
            </button>
            <button
              type="button"
              onClick={confirmReturnToWriting}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-800"
            >
              Open script
            </button>
          </div>
        </div>
      </Dialog>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className="sp-status-bar">
        {!readOnly && (
          <span className="sp-status-hint flex items-center gap-2">
            <SaveIndicator status={autosaveStatus} isDirty={isDirty} />
            <span className="text-stone-300">·</span>
            Last saved {new Date(script.updatedAt).toLocaleTimeString()}
          </span>
        )}
        <span className="ml-auto sp-status-hint">
          DevTools → <code>window.__getBlocks()</code>
        </span>
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        resourceType="script"
        resourceId={script.id}
        currentUserId={userId}
        currentUserRole={currentUserRole}
      />
    </div>
  )
}
