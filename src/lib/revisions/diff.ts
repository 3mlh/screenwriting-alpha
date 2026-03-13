// ── Block diff algorithm ───────────────────────────────────────────────────────
//
// diffSnapshots(before, after) → BlockDiff[]
//
// Uses stable block UUIDs as the key — blocks never change IDs on edit, only
// text/metadata. This makes the diff O(n) with two Map lookups.
//
// Change types:
//   added    — block exists in `after` but not `before`
//   removed  — block exists in `before` but not `after`
//   modified — block exists in both but text differs
//
// UNCHANGED blocks are omitted from the result.
//
// For `modified` blocks, `inlineDiff` contains a character-level diff of the
// text so the UI can highlight exactly which characters changed within the block
// (e.g. half a line of dialogue was rewritten). Uses diff-match-patch.
//
// Ordering: added/modified blocks follow their position in `after`.
// Removed blocks appear at their original position from `before`.

import { diff_match_patch, type Diff } from 'diff-match-patch'
import type { Block, BlockDiff } from '@/types/screenplay'

const dmp = new diff_match_patch()

// InlineDiff segment — a run of unchanged, inserted, or deleted characters
export interface InlineDiffSegment {
  op: 'equal' | 'insert' | 'delete'
  text: string
}

export function computeInlineDiff(before: string, after: string): InlineDiffSegment[] {
  const diffs: Diff[] = dmp.diff_main(before, after)
  dmp.diff_cleanupSemantic(diffs)
  return diffs.map(([op, text]) => ({
    op: op === 0 ? 'equal' : op === 1 ? 'insert' : 'delete',
    text,
  }))
}

export function diffSnapshots(
  before: Block[],
  after: Block[],
  revisionSetId: string
): BlockDiff[] {
  const beforeMap = new Map<string, Block>(before.map((b) => [b.id, b]))
  const afterMap = new Map<string, Block>(after.map((b) => [b.id, b]))

  const diffs: BlockDiff[] = []

  // Walk `after` in order — find added and modified
  for (const block of after) {
    const prev = beforeMap.get(block.id)
    if (!prev) {
      diffs.push({
        blockId: block.id,
        changeType: 'added',
        currentText: block.text,
        revisionSetId,
      })
    } else if (prev.text !== block.text) {
      diffs.push({
        blockId: block.id,
        changeType: 'modified',
        previousText: prev.text,
        currentText: block.text,
        inlineDiff: computeInlineDiff(prev.text, block.text),
        revisionSetId,
      })
    }
  }

  // Walk `before` in order — find removed
  for (const block of before) {
    if (!afterMap.has(block.id)) {
      diffs.push({
        blockId: block.id,
        changeType: 'removed',
        previousText: block.text,
        revisionSetId,
      })
    }
  }

  return diffs
}

// ── Convenience: build a Set of changed block IDs ────────────────────────────
//
// Used by RevisionMarkPlugin to quickly check whether a given block needs
// a margin mark without scanning the full diff array.

export function changedBlockIds(diffs: BlockDiff[]): Set<string> {
  return new Set(diffs.map((d) => d.blockId))
}
