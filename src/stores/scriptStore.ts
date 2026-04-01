import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Block, Script, RevisionSet, BlockDiff, CursorAnchor, WritingPin } from '@/types/screenplay'
import type { ScrollPlacement } from '@/lib/editor/scrollToBlock'

const WRITING_PIN_SESSION_KEY = 'screenwriting-writing-pin'

function readStoredWritingPin(): WritingPin | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(WRITING_PIN_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WritingPin
  } catch {
    return null
  }
}

function writeStoredWritingPin(pin: WritingPin | null) {
  if (typeof window === 'undefined') return

  if (!pin) {
    window.sessionStorage.removeItem(WRITING_PIN_SESSION_KEY)
    return
  }

  window.sessionStorage.setItem(WRITING_PIN_SESSION_KEY, JSON.stringify(pin))
}

// ─── Autosave status ──────────────────────────────────────────────────────────

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// ─── State shape ──────────────────────────────────────────────────────────────

interface ScriptState {
  // The canonical in-memory blocks. This is what gets serialized to the DB.
  blocks: Block[]

  // The script metadata (id, title, format, etc.). null when no script is open.
  script: Script | null

  // Dirty flag: true when blocks have changed since last save.
  isDirty: boolean

  // Autosave lifecycle indicator — drives SaveIndicator component.
  autosaveStatus: AutosaveStatus

  // Block type of the currently focused block, for the status bar.
  focusedBlockType: string | null

  // The scene heading block id of the scene the cursor is currently in.
  activeSceneId: string | null

  // Most recent in-editor cursor position for return navigation.
  lastCursorAnchor: CursorAnchor | null

  // Search jump destination highlight. Cleared only on actual content edits.
  jumpHighlightBlockId: string | null

  // Pending cursor restore request after cross-script navigation.
  pendingCursorRestore: CursorAnchor | null
  pendingCursorRestorePlacement: ScrollPlacement | null
  cursorReturnHighlight: { blockId: string; nonce: number } | null

  // The single session-scoped writing pin across scripts.
  writingPin: WritingPin | null

  // Blocks received from a real-time peer update. When set, the
  // RealtimeBlockLoaderPlugin inside Lexical loads them and clears this field.
  pendingExternalBlocks: Block[] | null

  // The updated_at timestamp of the last save we initiated. Used to filter
  // our own saves out of the realtime subscription so the editor isn't reloaded.
  lastOwnSavedAt: string | null

  // ── Revision state ──────────────────────────────────────────────────────────

  // The active revision set, if any. Populated when the script has
  // current_revision_set_id set. Drives RevisionMarkPlugin margin marks.
  activeRevisionSet: RevisionSet | null

  // Diffs between the open snapshot and the current state.
  // Keyed on blockId for O(1) lookup in RevisionMarkPlugin.
  revisionDiffs: Map<string, BlockDiff>

  // Whether the revision panel is open in the left rail.
  revisionPanelOpen: boolean
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface ScriptActions {
  setBlocks: (blocks: Block[]) => void
  setScript: (script: Script | null) => void
  setEditorDirty: (dirty: boolean) => void
  setAutosaveStatus: (status: AutosaveStatus) => void
  setFocusedBlockType: (type: string | null) => void
  setActiveSceneId: (id: string | null) => void
  setLastCursorAnchor: (cursor: CursorAnchor | null) => void
  setJumpHighlightBlockId: (id: string | null) => void
  clearJumpHighlight: () => void
  setPendingCursorRestore: (cursor: CursorAnchor | null) => void
  setPendingCursorRestorePlacement: (placement: ScrollPlacement | null) => void
  clearPendingCursorRestore: () => void
  triggerCursorReturnHighlight: (blockId: string) => void
  clearCursorReturnHighlight: () => void
  hydrateWritingPin: () => void
  setWritingPin: (pin: WritingPin) => void
  clearWritingPin: () => void
  setPendingExternalBlocks: (blocks: Block[] | null) => void
  setLastOwnSavedAt: (t: string | null) => void
  setActiveRevisionSet: (rs: RevisionSet | null) => void
  setRevisionDiffs: (diffs: BlockDiff[]) => void
  setRevisionPanelOpen: (open: boolean) => void
  reset: () => void
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: ScriptState = {
  blocks: [],
  script: null,
  isDirty: false,
  autosaveStatus: 'idle',
  focusedBlockType: null,
  activeSceneId: null,
  lastCursorAnchor: null,
  jumpHighlightBlockId: null,
  pendingCursorRestore: null,
  pendingCursorRestorePlacement: null,
  cursorReturnHighlight: null,
  writingPin: null,
  pendingExternalBlocks: null,
  lastOwnSavedAt: null,
  activeRevisionSet: null,
  revisionDiffs: new Map(),
  revisionPanelOpen: false,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useScriptStore = create<ScriptState & ScriptActions>()(
  immer((set) => ({
    ...initialState,

    setBlocks: (blocks) =>
      set((state) => {
        state.blocks = blocks
      }),

    setScript: (script) =>
      set((state) => {
        const prevId = state.script?.id ?? null
        state.script = script
        if ((script?.id ?? null) !== prevId) {
          state.lastCursorAnchor = null
          state.jumpHighlightBlockId = null
          state.pendingCursorRestore = null
          state.pendingCursorRestorePlacement = null
          state.cursorReturnHighlight = null
        }
        if (script !== null) state.revisionPanelOpen = false
      }),

    setEditorDirty: (dirty) =>
      set((state) => {
        state.isDirty = dirty
      }),

    setAutosaveStatus: (status) =>
      set((state) => {
        state.autosaveStatus = status
      }),

    setFocusedBlockType: (type) =>
      set((state) => {
        state.focusedBlockType = type
      }),

    setActiveSceneId: (id) =>
      set((state) => {
        state.activeSceneId = id
      }),

    setLastCursorAnchor: (cursor) =>
      set((state) => {
        state.lastCursorAnchor = cursor
      }),

    setJumpHighlightBlockId: (id) =>
      set((state) => {
        state.jumpHighlightBlockId = id
      }),

    clearJumpHighlight: () =>
      set((state) => {
        state.jumpHighlightBlockId = null
      }),

    setPendingCursorRestore: (cursor) =>
      set((state) => {
        state.pendingCursorRestore = cursor
      }),

    setPendingCursorRestorePlacement: (placement) =>
      set((state) => {
        state.pendingCursorRestorePlacement = placement
      }),

    clearPendingCursorRestore: () =>
      set((state) => {
        state.pendingCursorRestore = null
        state.pendingCursorRestorePlacement = null
      }),

    triggerCursorReturnHighlight: (blockId) =>
      set((state) => {
        state.cursorReturnHighlight = { blockId, nonce: Date.now() }
      }),

    clearCursorReturnHighlight: () =>
      set((state) => {
        state.cursorReturnHighlight = null
      }),

    hydrateWritingPin: () =>
      set((state) => {
        state.writingPin = readStoredWritingPin()
      }),

    setWritingPin: (pin) => {
      writeStoredWritingPin(pin)
      set((state) => {
        state.writingPin = pin
      })
    },

    clearWritingPin: () => {
      writeStoredWritingPin(null)
      set((state) => {
        state.writingPin = null
      })
    },

    setPendingExternalBlocks: (blocks) =>
      set((state) => {
        state.pendingExternalBlocks = blocks
      }),

    setLastOwnSavedAt: (t) =>
      set((state) => {
        state.lastOwnSavedAt = t
      }),

    setActiveRevisionSet: (rs) =>
      set((state) => {
        state.activeRevisionSet = rs
      }),

    setRevisionDiffs: (diffs) =>
      set((state) => {
        const map = new Map<string, BlockDiff>()
        for (const d of diffs) map.set(d.blockId, d)
        state.revisionDiffs = map
      }),

    setRevisionPanelOpen: (open) =>
      set((state) => {
        state.revisionPanelOpen = open
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, { ...initialState, revisionDiffs: new Map() })
      }),
  }))
)
