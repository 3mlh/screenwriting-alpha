'use client'

// ── RevisionToolbar ────────────────────────────────────────────────────────────
//
// Collapsible form for starting a new revision draft.
// Collapsed by default; expands on "New Revision" click.

import { useState, useCallback } from 'react'
import type { RevisionSet } from '@/types/screenplay'

// WGA standard revision draft colors + "no color" sentinel
const WGA_COLORS = [
  { label: 'No color', value: '' },
  { label: 'White',     value: '#FFFFFF' },
  { label: 'Blue',      value: '#4A90D9' },
  { label: 'Pink',      value: '#E879A0' },
  { label: 'Yellow',    value: '#F5C518' },
  { label: 'Green',     value: '#4CAF50' },
  { label: 'Goldenrod', value: '#DAA520' },
  { label: 'Buff',      value: '#E8C99A' },
  { label: 'Salmon',    value: '#FA8072' },
  { label: 'Cherry',    value: '#C0392B' },
  { label: 'Tan',       value: '#D2B48C' },
  { label: 'Ivory',     value: '#FFFFF0' },
]

interface Props {
  scriptId: string
  onOpened: (rs: RevisionSet) => void
}

export function RevisionToolbar({ scriptId, onOpened }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(WGA_COLORS[4].value) // Yellow default
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openRevision = useCallback(async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scripts/${scriptId}/revision-sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to open revision'); return }
      setName('')
      setExpanded(false)
      onOpened(data.revisionSet as RevisionSet)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [scriptId, name, color, onOpened])

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full px-3 py-1.5 text-xs font-medium text-gray-600 border border-dashed border-stone-300 rounded-lg hover:bg-stone-50 hover:border-stone-400 transition-colors"
      >
        + New Revision
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Draft name (e.g. Yellow Draft)"
        className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
        maxLength={100}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') openRevision()
          if (e.key === 'Escape') setExpanded(false)
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {WGA_COLORS.map((c) => (
          <button
            key={c.value === '' ? '__none__' : c.value}
            title={c.label}
            onClick={() => setColor(c.value)}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${
              color === c.value
                ? 'border-amber-500 scale-110'
                : 'border-transparent hover:border-stone-300'
            }`}
            style={
              c.value
                ? { background: c.value, boxShadow: '0 0 0 1px rgba(0,0,0,0.12)' }
                : { background: 'white', boxShadow: '0 0 0 1px rgba(0,0,0,0.20)' }
            }
          >
            {/* Render an X for the no-color swatch */}
            {c.value === '' && (
              <span className="text-[8px] text-gray-400 leading-none">✕</span>
            )}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setExpanded(false)}
          className="flex-1 px-3 py-1.5 text-xs text-gray-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={openRevision}
          disabled={loading || !name.trim()}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Opening…' : 'Open'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
