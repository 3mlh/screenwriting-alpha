import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Block, Script } from '@/types/screenplay'

// ─── State shape ──────────────────────────────────────────────────────────────

interface ScriptState {
  // The canonical in-memory blocks. This is what gets serialized to the DB.
  blocks: Block[]

  // The script metadata (id, title, format, etc.). null in M1 (no auth).
  script: Script | null

  // Dirty flag: true when blocks have changed since last save.
  // Used by AutosavePlugin (M2) to decide when to fire.
  isDirty: boolean

  // Block type of the currently focused block, for the status bar.
  focusedBlockType: string | null

  // The scene heading block id of the scene the cursor is currently in.
  activeSceneId: string | null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface ScriptActions {
  setBlocks: (blocks: Block[]) => void
  setScript: (script: Script | null) => void
  setEditorDirty: (dirty: boolean) => void
  setFocusedBlockType: (type: string | null) => void
  setActiveSceneId: (id: string | null) => void
  reset: () => void
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: ScriptState = {
  blocks: [],
  script: null,
  isDirty: false,
  focusedBlockType: null,
  activeSceneId: null,
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
        state.script = script
      }),

    setEditorDirty: (dirty) =>
      set((state) => {
        state.isDirty = dirty
      }),

    setFocusedBlockType: (type) =>
      set((state) => {
        state.focusedBlockType = type
      }),

    setActiveSceneId: (id) =>
      set((state) => {
        state.activeSceneId = id
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, initialState)
      }),
  }))
)
