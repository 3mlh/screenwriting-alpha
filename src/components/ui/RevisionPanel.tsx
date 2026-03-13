'use client'

// ── RevisionPanel ──────────────────────────────────────────────────────────────
//
// Left-rail sidebar panel for revision/versioning. Three sections:
//   - Start a new revision (collapsible form, collapsed by default)
//   - Current version (active revision set + close button)
//   - Past revisions (closed revision sets)
//
// Owns the full revision set list. Loads on mount and refreshes after
// open/close. Also loads diffs for the active revision so RevisionMarkPlugin
// has data to work with.

import { useEffect, useCallback } from 'react'
import { useScriptStore } from '@/stores/scriptStore'
import { RevisionToolbar } from './RevisionToolbar'
import type { RevisionSet, BlockDiff, PermissionLevel } from '@/types/screenplay'
import { useState } from 'react'

interface Props {
  scriptId: string
  currentUserRole: PermissionLevel
  initialRevisionSetId?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function RevisionPanel({ scriptId, currentUserRole, initialRevisionSetId }: Props) {
  const [allRevisionSets, setAllRevisionSets] = useState<RevisionSet[]>([])
  const [loadingClose, setLoadingClose] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const setActiveRevisionSet = useScriptStore((s) => s.setActiveRevisionSet)
  const setRevisionDiffs = useScriptStore((s) => s.setRevisionDiffs)
  const activeRevisionSet = useScriptStore((s) => s.activeRevisionSet)

  const readOnly = currentUserRole === 'viewer'
  const pastRevisions = allRevisionSets.filter((rs) => !rs.isActive)

  // ── Load revision sets ──────────────────────────────────────────────────────

  const loadRevisionSets = useCallback(async () => {
    const res = await fetch(`/api/scripts/${scriptId}/revision-sets`)
    if (!res.ok) return [] as RevisionSet[]
    const data = await res.json()
    const sets: RevisionSet[] = data.revisionSets ?? []
    setAllRevisionSets(sets)
    return sets
  }, [scriptId])

  // On mount: load all sets; if one is active, also load its diffs
  useEffect(() => {
    async function init() {
      const sets = await loadRevisionSets()
      if (!initialRevisionSetId) return
      const active = sets.find((rs) => rs.id === initialRevisionSetId) ?? null
      setActiveRevisionSet(active)
      if (active) {
        const diffRes = await fetch(`/api/scripts/${scriptId}/revision-sets/${active.id}/diff`)
        if (diffRes.ok) {
          const data = await diffRes.json()
          setRevisionDiffs(data.diffs ?? [])
        }
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh diffs whenever the active revision set changes
  useEffect(() => {
    if (!activeRevisionSet) { setRevisionDiffs([]); return }
    fetch(`/api/scripts/${scriptId}/revision-sets/${activeRevisionSet.id}/diff`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setRevisionDiffs((data.diffs ?? []) as BlockDiff[]) })
  }, [activeRevisionSet, scriptId, setRevisionDiffs])

  // ── Open / close handlers ───────────────────────────────────────────────────

  const handleOpened = useCallback(async (rs: RevisionSet) => {
    setActiveRevisionSet(rs)
    setRevisionDiffs([])
    await loadRevisionSets()
  }, [setActiveRevisionSet, setRevisionDiffs, loadRevisionSets])

  const handleClose = useCallback(async () => {
    if (!activeRevisionSet) return
    setLoadingClose(true)
    setCloseError(null)
    try {
      const res = await fetch(
        `/api/scripts/${scriptId}/revision-sets/${activeRevisionSet.id}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'close' }) }
      )
      const data = await res.json()
      if (!res.ok) { setCloseError(data.error ?? 'Failed to close revision'); return }
      setActiveRevisionSet(null)
      setRevisionDiffs([])
      await loadRevisionSets()
    } catch {
      setCloseError('Network error')
    } finally {
      setLoadingClose(false)
    }
  }, [scriptId, activeRevisionSet, setActiveRevisionSet, setRevisionDiffs, loadRevisionSets])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col divide-y divide-stone-100">

      {/* ── Start a new revision ───────────────────────────────────────────── */}
      {!readOnly && (
        <section className="p-3 flex flex-col gap-2">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            Start a new version
          </p>
          {activeRevisionSet ? (
            <p className="text-[11px] text-gray-400">
              Close the current version to start a new one.
            </p>
          ) : (
            <RevisionToolbar scriptId={scriptId} onOpened={handleOpened} />
          )}
        </section>
      )}

      {/* ── Current version ───────────────────────────────────────────────── */}
      <section className="p-3 flex flex-col gap-2">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
          Current version
        </p>
        {activeRevisionSet ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {activeRevisionSet.color ? (
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                  style={{ background: activeRevisionSet.color }}
                />
              ) : (
                <span className="w-3 h-3 rounded-full flex-shrink-0 border border-stone-300 bg-white" />
              )}
              <span className="text-xs font-medium text-gray-800 truncate">
                {activeRevisionSet.name}
              </span>
              <span className="ml-auto text-[10px] text-emerald-600 font-medium">Active</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Opened {formatDate(activeRevisionSet.openedAt)}
            </p>
            {!readOnly && (
              <>
                <button
                  onClick={handleClose}
                  disabled={loadingClose}
                  className="w-full px-3 py-1.5 text-xs font-medium text-gray-600 border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-50 transition-colors"
                >
                  {loadingClose ? 'Closing…' : 'Close Revision'}
                </button>
                {closeError && <p className="text-[11px] text-red-500">{closeError}</p>}
              </>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400">No active revision</p>
        )}
      </section>

      {/* ── Past revisions ─────────────────────────────────────────────────── */}
      <section className="p-3 flex flex-col gap-2">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
          Past revisions
        </p>
        {pastRevisions.length === 0 ? (
          <p className="text-[11px] text-gray-400">None yet</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pastRevisions.map((rs) => (
              <li key={rs.id} className="flex items-center gap-2 py-1">
                {rs.color ? (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-black/10"
                    style={{ background: rs.color }}
                  />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-stone-300 bg-white" />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-gray-700 truncate">{rs.name}</span>
                  <span className="text-[10px] text-gray-400">
                    {formatDate(rs.openedAt)}
                    {rs.closedAt ? ` – ${formatDate(rs.closedAt)}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  )
}
