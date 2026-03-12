import {
  createEditor,
  $getRoot,
  $createTextNode,
} from 'lexical'
import type { Block } from '@/types/screenplay'
import { ScreenplayBlockNode } from '../nodes/ScreenplayBlockNode'
import { $createSceneHeadingNode } from '../nodes/SceneHeadingNode'
import { $createActionNode } from '../nodes/ActionNode'
import { $createCharacterNode } from '../nodes/CharacterNode'
import { $createDialogueNode } from '../nodes/DialogueNode'
import { $createParentheticalNode } from '../nodes/ParentheticalNode'
import { $createTransitionNode } from '../nodes/TransitionNode'
import { $createShotNode } from '../nodes/ShotNode'
import { $createSectionNode } from '../nodes/SectionNode'
import { $createSummaryNode } from '../nodes/SummaryNode'
import { $createColdOpenMarkerNode } from '../nodes/ColdOpenMarkerNode'
import { SCREENPLAY_NODES } from '../ScreenplayNodes'

// ─── Block → Lexical node ────────────────────────────────────────────────────

export function $createNodeForBlock(block: Block): ScreenplayBlockNode {
  const metadata = block.metadata as Record<string, unknown> | undefined

  switch (block.type) {
    case 'scene_heading':
      return $createSceneHeadingNode(block.id, block.position, metadata)
    case 'action':
      return $createActionNode(block.id, block.position, metadata)
    case 'character':
      return $createCharacterNode(block.id, block.position, metadata)
    case 'dialogue':
      return $createDialogueNode(block.id, block.position, metadata)
    case 'parenthetical':
      return $createParentheticalNode(block.id, block.position, metadata)
    case 'transition':
      return $createTransitionNode(block.id, block.position, metadata)
    case 'shot':
      return $createShotNode(block.id, block.position, metadata)
    case 'section':
      return $createSectionNode(block.id, block.position, metadata)
    case 'summary':
      return $createSummaryNode(block.id, block.position, metadata)
    case 'cold_open_marker':
      return $createColdOpenMarkerNode(block.id, block.position, metadata)
    default: {
      // Exhaustiveness check — if a new BlockType is added, this will error
      const _exhaustive: never = block.type
      throw new Error(`Unknown block type: ${String(_exhaustive)}`)
    }
  }
}

// ─── Load Block[] into an editor (in-place mutation) ─────────────────────────
//
// Call this inside editor.update() to replace the editor contents with
// a canonical Block[]. Used on initial load and on snapshot restore.
//
// Example:
//   editor.update(() => {
//     $loadBlocksIntoEditor(blocks)
//   })

export function $loadBlocksIntoEditor(blocks: Block[]): void {
  const root = $getRoot()
  root.clear()

  if (blocks.length === 0) {
    // Always start with at least one node so the editor is not empty
    const node = $createSceneHeadingNode()
    root.append(node)
    return
  }

  for (const block of blocks) {
    const node = $createNodeForBlock(block)

    // Set text content
    if (block.text) {
      const textNode = $createTextNode(block.text)
      node.append(textNode)
    }

    root.append(node)
  }
}

// ─── Standalone round-trip helper for tests ──────────────────────────────────
//
// Creates a temporary editor, loads blocks into it, then reads them back out.
// Useful for verifying round-trip correctness without a React component.

export async function roundTripBlocks(blocks: Block[]): Promise<Block[]> {
  const { lexicalToBlocks } = await import('./lexicalToBlocks')

  const editor = createEditor({
    nodes: SCREENPLAY_NODES,
    namespace: 'roundtrip-test',
    onError: (err) => { throw err },
  })

  let result: Block[] = []

  editor.update(
    () => {
      $loadBlocksIntoEditor(blocks)
    },
    { discrete: true }
  )

  result = lexicalToBlocks(editor.getEditorState())
  editor._pendingEditorState = null

  return result
}
