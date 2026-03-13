'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onRename: () => void
  onDelete: () => void
  canRename?: boolean
  canDelete?: boolean
}

export function ScriptContextMenu({ onRename, onDelete, canRename = true, canDelete = true }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-ctx-menu]')) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.right - 128 })
    }
    setOpen(v => !v)
  }

  if (!canRename && !canDelete) return null

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-stone-200 transition-all text-gray-400 hover:text-gray-700"
        aria-label="Script options"
        data-ctx-menu
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && createPortal(
        <div
          data-ctx-menu
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-50 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[128px]"
        >
          {canRename && (
            <button
              onClick={() => { setOpen(false); onRename() }}
              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors"
            >
              Rename
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => { setOpen(false); onDelete() }}
              className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
