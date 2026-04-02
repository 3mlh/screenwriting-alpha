'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { scrollToBlock } from '@/lib/editor/scrollToBlock'
import type { ScriptSearchResult, StoredScriptSearchState } from '@/lib/search/types'
import { useScriptStore } from '@/stores/scriptStore'

const SESSION_KEY_PREFIX = 'private-script-search'

function storageKey(id: string) {
  return `${SESSION_KEY_PREFIX}:${id}`
}

function readStoredSearchState(id: string): StoredScriptSearchState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(storageKey(id))
    if (!raw) return null
    return JSON.parse(raw) as StoredScriptSearchState
  } catch {
    return null
  }
}

function writeStoredSearchState(state: StoredScriptSearchState) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(storageKey(state.id), JSON.stringify(state))
}

async function fetchSearchResults(input: {
  projectId: string
  currentScriptId: string
  query: string
  signal: AbortSignal
}): Promise<ScriptSearchResult[]> {
  const response = await fetch(`/api/projects/${input.projectId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: input.query,
      limit: 8,
      currentScriptId: input.currentScriptId,
    }),
    signal: input.signal,
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error || 'Failed to search scripts')
  }

  return (body?.results ?? []) as ScriptSearchResult[]
}

export function ScriptSearchControl({
  projectId,
  currentScriptId,
}: {
  projectId: string
  currentScriptId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const resultsScrollRef = useRef<HTMLDivElement | null>(null)
  const skipFetchForQueryRef = useRef<string | null>(null)
  const handledRestoreTokenRef = useRef<string | null>(null)
  const resultsScrollTopRef = useRef(0)
  const pendingScrollTopRef = useRef<number | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ScriptSearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [returnToken, setReturnToken] = useState<string | null>(null)
  const [returnStateOverride, setReturnStateOverride] = useState<StoredScriptSearchState | null>(null)
  const setJumpHighlightBlockId = useScriptStore((s) => s.setJumpHighlightBlockId)
  const triggerCursorReturnHighlight = useScriptStore((s) => s.triggerCursorReturnHighlight)

  const restoreToken = searchParams.get('restoreSearch')
  const searchReturnToken = searchParams.get('returnSearch')

  const returnState = useMemo(
    () => (searchReturnToken ? readStoredSearchState(searchReturnToken) : null),
    [searchReturnToken]
  )
  const activeReturnState = returnStateOverride ?? returnState

  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
    inputRef.current?.select()
    if (resultsScrollRef.current && pendingScrollTopRef.current !== null) {
      resultsScrollRef.current.scrollTop = pendingScrollTopRef.current
      pendingScrollTopRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function applyStoredSearchState(
    state: StoredScriptSearchState,
    options?: { clearReturnToken?: boolean; open?: boolean }
  ) {
    skipFetchForQueryRef.current = state.query
    setQuery(state.query)
    setResults(state.results)
    setActiveIndex(
      Math.max(0, Math.min(state.activeIndex ?? 0, Math.max(state.results.length - 1, 0)))
    )
    setError(null)
    setLoading(false)
    resultsScrollTopRef.current = state.scrollTop ?? 0
    pendingScrollTopRef.current = state.scrollTop ?? 0
    if (options?.open ?? true) setIsOpen(true)
    if (options?.clearReturnToken) setReturnToken(null)
  }

  useEffect(() => {
    if (!restoreToken || handledRestoreTokenRef.current === restoreToken) return

    const state = readStoredSearchState(restoreToken)
    if (!state || state.projectId !== projectId || state.originScriptId !== currentScriptId) return

    handledRestoreTokenRef.current = restoreToken
    setReturnStateOverride(null)
    applyStoredSearchState(state, { clearReturnToken: true, open: true })
    router.replace(pathname, { scroll: false })
  }, [currentScriptId, pathname, projectId, restoreToken, router])

  useEffect(() => {
    const token = searchReturnToken ?? null
    if (!token || !returnState) {
      setReturnToken(null)
      return
    }
    setReturnStateOverride(null)
    setReturnToken(token)
  }, [returnState, searchReturnToken])

  useEffect(() => {
    if (!isOpen) return

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setLoading(false)
      setError(null)
      setResults([])
      setActiveIndex(0)
      return
    }

    if (skipFetchForQueryRef.current === trimmed) {
      skipFetchForQueryRef.current = null
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError(null)
        const nextResults = await fetchSearchResults({
          projectId,
          currentScriptId,
          query: trimmed,
          signal: controller.signal,
        })
        setResults(nextResults)
        setActiveIndex(0)
      } catch (err) {
        if (controller.signal.aborted) return
        setResults([])
        setError(err instanceof Error ? err.message : 'Failed to search scripts')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [currentScriptId, isOpen, projectId, query])

  useEffect(() => {
    if (!isOpen || results.length === 0) return

    const seen = new Set<string>()
    for (const result of results) {
      if (result.scriptId === currentScriptId) continue
      if (seen.has(result.scriptId)) continue
      seen.add(result.scriptId)
      router.prefetch(`/app/scripts/${result.scriptId}`)
      if (seen.size >= 3) break
    }
  }, [currentScriptId, isOpen, results, router])

  function handleOpenToggle() {
    if (isOpen) {
      setIsOpen(false)
      return
    }

    if (returnToken && activeReturnState) {
      applyStoredSearchState(activeReturnState, { open: true })
      return
    }

    setIsOpen(true)
  }

  function persistCurrentSearchState(selectedIndex = activeIndex) {
    const state: StoredScriptSearchState = {
      id: crypto.randomUUID(),
      projectId,
      originScriptId: currentScriptId,
      query,
      results,
      activeIndex: selectedIndex,
      scrollTop: resultsScrollTopRef.current,
      createdAt: new Date().toISOString(),
    }
    writeStoredSearchState(state)
    return state
  }

  function jumpToResult(result: ScriptSearchResult, index: number) {
    const state = persistCurrentSearchState(index)
    setIsOpen(false)
    const href = `/app/scripts/${result.scriptId}?focusBlock=${encodeURIComponent(result.blockId)}&returnSearch=${encodeURIComponent(state.id)}`

    if (result.scriptId === currentScriptId) {
      setReturnToken(state.id)
      setReturnStateOverride(state)
      setJumpHighlightBlockId(result.blockId)

      let attempts = 0
      const tryScroll = () => {
        if (scrollToBlock(result.blockId, { placement: 'search-result' })) {
          triggerCursorReturnHighlight(result.blockId)
          return
        }

        attempts += 1
        if (attempts < 10) {
          window.setTimeout(tryScroll, 40)
        }
      }

      window.requestAnimationFrame(tryScroll)
      return
    }

    router.push(href)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }

    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      jumpToResult(results[activeIndex], activeIndex)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <button
        onClick={handleOpenToggle}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          isOpen || (returnToken && activeReturnState)
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-stone-200 text-gray-600 hover:bg-stone-50 hover:text-gray-900'
        }`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        Search
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[30rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
          <div className="border-b border-stone-200 px-4 py-3">
            <label className="sr-only" htmlFor="script-search-input">Search project scripts</label>
            <input
              id="script-search-input"
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Try “when did Lucille say …”'
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-amber-300 focus:bg-white"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
              <span>Project-wide, private search</span>
              <span>Enter to jump</span>
            </div>
          </div>

          <div
            ref={resultsScrollRef}
            className="max-h-[24rem] overflow-y-auto"
            onScroll={(event) => {
              resultsScrollTopRef.current = event.currentTarget.scrollTop
            }}
          >
            {loading && (
              <div className="px-4 py-4 text-sm text-gray-500">Searching scripts…</div>
            )}

            {!loading && error && (
              <div className="px-4 py-4 text-sm text-red-600">{error}</div>
            )}

            {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
              <div className="px-4 py-4 text-sm text-gray-500">No matching snippets yet.</div>
            )}

            {!loading && !error && query.trim().length < 2 && (
              <div className="px-4 py-4 text-sm text-gray-500">
                Start typing to search dialogue, action, scenes, and more.
              </div>
            )}

            {!loading && !error && results.map((result, index) => (
              <button
                key={`${result.scriptId}:${result.blockId}`}
                onClick={() => jumpToResult(result, index)}
                className={`w-full border-b border-stone-100 px-4 py-3 text-left transition last:border-b-0 ${
                  index === activeIndex ? 'bg-amber-50' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">
                      Script
                    </div>
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {result.scriptTitle}
                    </div>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] tracking-[0.12em] text-gray-500">
                    {result.blockType.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-2 text-sm leading-6 text-gray-600">
                  {result.snippet}
                </div>
                {(result.actLabel || result.sceneLabel || result.speaker) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                    {result.actLabel && <span>Act: {result.actLabel}</span>}
                    {result.sceneLabel && <span>Scene: {result.sceneLabel}</span>}
                    {result.speaker && <span>Speaker: {result.speaker}</span>}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
