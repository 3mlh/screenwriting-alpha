'use client'

// ── SnapshotHistory ────────────────────────────────────────────────────────────
//
// Lists script_snapshots (metadata only). Supports:
//   - "Save Version" — manual snapshot with optional label
//   - Restore to a snapshot (owner only, requires confirmation)
//
// Snapshots are loaded on mount. The list refreshes after a manual save or restore.

import { useState, useEffect, useCallback } from 'react'
import type { ScriptSnapshot } from '@/types/screenplay'

interface Props {
  scriptId: string
  isOwner: boolean
}

const TRIGGER_LABELS: Record<ScriptSnapshot['triggerType'], string> = {
  manual: 'Manual',
  autosave: 'Autosave',
  revision_open: 'Revision opened',
  revision_close: 'Revision closed',
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function SnapshotHistory({ scriptId, isOwner }: Props) {
  const [snapshots, setSnapshots] = useState<Omit<ScriptSnapshot, 'blocks'>[]>([])
  const [loading, setLoading] = useState(true)
  const [savingLabel, setSavingLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadSnapshots = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scripts/${scriptId}/snapshots`)
      if (!res.ok) return
      const data = await res.json()
      setSnapshots(data.snapshots ?? [])
    } finally {
      setLoading(false)
    }
  }, [scriptId])

  useEffect(() => { loadSnapshots() }, [loadSnapshots])

  const saveVersion = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/scripts/${scriptId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: savingLabel.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save version'); return }
      setSavingLabel('')
      await loadSnapshots()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }, [scriptId, savingLabel, loadSnapshots])

  const restore = useCallback(async (snapshotId: string) => {
    // Find the revision set that owns this snapshot if possible
    // For MVP: restore via revision-sets restore endpoint requires a revision set id.
    // For ad-hoc snapshot restore we use a dedicated endpoint.
    if (!window.confirm('Restore script to this snapshot? A pre-restore backup will be saved automatically.')) return
    setRestoringId(snapshotId)
    setError(null)
    try {
      const res = await fetch(`/api/scripts/${scriptId}/snapshots/${snapshotId}/restore`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Restore failed'); return }
      // Reload the page so the editor picks up the restored blocks
      window.location.reload()
    } catch {
      setError('Network error')
    } finally {
      setRestoringId(null)
    }
  }, [scriptId])

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Save version form */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-gray-400">Save current state as a named version</p>
        <input
          type="text"
          value={savingLabel}
          onChange={(e) => setSavingLabel(e.target.value)}
          placeholder="Version label (optional)"
          className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
          maxLength={200}
          onKeyDown={(e) => { if (e.key === 'Enter') saveVersion() }}
        />
        <button
          onClick={saveVersion}
          disabled={saving}
          className="w-full px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Version'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {/* Snapshot list */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">History</p>
        {loading ? (
          <p className="text-xs text-gray-400 py-2">Loading…</p>
        ) : snapshots.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No snapshots yet</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {snapshots.map((snap) => (
              <li
                key={snap.id}
                className="flex items-start justify-between gap-2 px-2 py-2 rounded-lg hover:bg-stone-50 group"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs text-gray-800 truncate">
                    {snap.label ?? TRIGGER_LABELS[snap.triggerType]}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {formatRelativeTime(snap.takenAt)}
                  </span>
                </div>
                {isOwner && (
                  <button
                    onClick={() => restore(snap.id)}
                    disabled={restoringId === snap.id}
                    className="flex-shrink-0 text-[10px] text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {restoringId === snap.id ? '…' : 'Restore'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
