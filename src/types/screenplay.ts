// ─── Block Types ─────────────────────────────────────────────────────────────
//
// This is the canonical screenplay block model. Every other concern —
// database schema, autosave payload, diff algorithm, revision model,
// scene derivation — depends on this being stable. Do not change the
// shape of Block or BlockType without a migration plan for all consumers.

export const BLOCK_TYPES = [
  'scene_heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
  'section',
  'summary',
  'cold_open_marker',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export type SectionType =
  | 'act_start'
  | 'act_end'
  | 'sequence'
  | 'summary'
  | 'cold_open_start'
  | 'cold_open_end'

// ─── Metadata Types ───────────────────────────────────────────────────────────

export interface SectionMetadata {
  section_type: SectionType
  label?: string
  level?: 1 | 2 | 3
}

export interface SceneHeadingMetadata {
  scene_number?: string
  time_of_day?: string // parsed from text: DAY, NIGHT, CONTINUOUS, etc.
  location?: string    // parsed from text
  int_ext?: 'INT' | 'EXT' | 'INT/EXT' | 'EXT/INT'
}

export interface CharacterMetadata {
  is_dual_dialogue?: boolean
  extension?: string // V.O., O.S., CONT'D
}

// ─── Core Block ───────────────────────────────────────────────────────────────

export interface Block {
  // Stable UUID — never regenerated on edit. The diff algorithm keys on this.
  id: string

  type: BlockType

  text: string

  // Optional structured metadata. Type-specific; see metadata interfaces above.
  metadata?:
    | SectionMetadata
    | SceneHeadingMetadata
    | CharacterMetadata
    | Record<string, unknown>

  // Sparse integer for ordering (gap-based: 1000, 2000, 3000…).
  // Never reuse deleted positions; always insert into gaps.
  position: number
}

// ─── Derived Types (never stored) ────────────────────────────────────────────

// A Scene is derived at read time from a Block[]. Never store it.
export interface Scene {
  id: string          // = the scene_heading block's id
  sceneNumber: number // 1-based ordinal across the script
  heading: Block      // the scene_heading block itself
  blocks: Block[]     // all blocks after the heading until the next scene_heading
  startPosition: number
}

export interface OutlineNode {
  id: string
  type: 'section' | 'scene'
  label: string
  level?: 1 | 2 | 3       // for section nodes
  sceneNumber?: number     // for scene nodes
  children?: OutlineNode[] // sections can contain scenes
}

// ─── Script ───────────────────────────────────────────────────────────────────

export type ScriptFormat = 'feature' | 'pilot' | 'spec' | 'short'

export interface Script {
  id: string
  projectId: string
  title: string
  format: ScriptFormat
  blocks: Block[]
  lockedAt?: string
  lockedByUserId?: string
  currentRevisionSetId?: string
  createdAt: string
  updatedAt: string
  createdByUserId: string
}

// ─── Project ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  title: string
  description?: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

// ─── Permissions ─────────────────────────────────────────────────────────────

export type PermissionLevel = 'owner' | 'editor' | 'viewer'

export interface ProjectMember {
  projectId: string
  userId: string
  role: PermissionLevel
  invitedByUserId: string
  addedAt: string
}

export interface ScriptMember {
  scriptId: string
  userId: string
  role: PermissionLevel
  invitedByUserId: string
  addedAt: string
}

// ─── Revision Types ───────────────────────────────────────────────────────────

export interface ScriptSnapshot {
  id: string
  scriptId: string
  blocks: Block[]           // full immutable copy
  takenAt: string
  takenByUserId: string
  label?: string
  triggerType: 'manual' | 'autosave' | 'revision_open' | 'revision_close'
}

export interface RevisionSet {
  id: string
  scriptId: string
  name: string              // "Yellow Draft", "Blue Draft"
  color: string             // hex
  openedAt: string
  closedAt?: string
  openSnapshotId: string
  closeSnapshotId?: string
  createdByUserId: string
  isActive: boolean
}

// Derived — never stored
export interface BlockDiff {
  blockId: string
  changeType: 'added' | 'removed' | 'modified'
  previousText?: string
  currentText?: string
  revisionSetId: string
}
