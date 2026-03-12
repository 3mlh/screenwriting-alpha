import { EditorState, $getRoot, $isElementNode, LexicalNode } from 'lexical'
import { $isTextNode } from 'lexical'
import type { Block, BlockType } from '@/types/screenplay'
import { $isScreenplayBlockNode } from '../nodes/ScreenplayBlockNode'
import { validateBlocks } from '@/lib/validation/block.schema'

// ─── Main export ─────────────────────────────────────────────────────────────
//
// Convert the current Lexical EditorState into canonical Block[].
//
// This is called:
//   - By the autosave plugin (M2) to get the payload for PUT /blocks
//   - From the browser console to inspect state during development
//   - By tests to verify round-trip correctness
//
// IMPORTANT: Call this inside editor.read() or from within a Lexical command
// handler. Do not call this outside of an editor context.

export function lexicalToBlocks(editorState: EditorState): Block[] {
  let blocks: Block[] = []

  editorState.read(() => {
    const root = $getRoot()
    const children = root.getChildren()

    blocks = children
      .map((node, index) => nodeToBlock(node, index))
      .filter((block): block is Block => block !== null)
  })

  return blocks
}

// ─── Single-node conversion ──────────────────────────────────────────────────

function nodeToBlock(node: LexicalNode, index: number): Block | null {
  if (!$isScreenplayBlockNode(node)) {
    // Non-screenplay nodes (e.g. stray ParagraphNodes) are skipped.
    // This can happen if Lexical inserts a default node; we silently drop it.
    return null
  }

  // Text content: join all text node descendants.
  // We do NOT preserve inline formatting because the canonical model is plain text.
  // Inline bold/italic is a presentation concern, not a data concern.
  const text = extractText(node)

  // Position is recalculated as 1000 * index for M1.
  // M2 will use gap-based positions from the DB; on load, positions come from
  // stored Block[] and are preserved through this conversion on subsequent saves.
  const position = node.getBlockPosition() > 0
    ? node.getBlockPosition()
    : (index + 1) * 1000

  const block: Block = {
    id: node.getBlockId(),
    type: node.getBlockType() as BlockType,
    text,
    position,
  }

  // Preserve metadata if present
  const metadata = node.getBlockMetadata()
  if (metadata && Object.keys(metadata).length > 0) {
    block.metadata = metadata
  }

  return block
}

// ─── Text extraction ──────────────────────────────────────────────────────────

function extractText(node: LexicalNode): string {
  if ($isTextNode(node)) {
    return node.getTextContent()
  }

  if ($isElementNode(node)) {
    return node
      .getChildren()
      .map(extractText)
      .join('')
  }

  return ''
}

// ─── Validated variant ───────────────────────────────────────────────────────
//
// Use this when you need to guarantee the output passes the Zod schema.
// The unvalidated variant is faster and used in the autosave hot path.

export function lexicalToBlocksValidated(editorState: EditorState): Block[] {
  const blocks = lexicalToBlocks(editorState)
  return validateBlocks(blocks)
}
