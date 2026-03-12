// ─── Shared block-type mutation utilities ─────────────────────────────────────
//
// Used by BlockTypePlugin (Enter key) and BlockTypeSelectorPlugin (dropdown).

import { $createTextNode, LexicalNode } from 'lexical'
import { $isScreenplayBlockNode, ScreenplayBlockNode } from './nodes/ScreenplayBlockNode'
import { $createNodeForBlock } from './serialization/blocksToLexical'
import type { Block, BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export function getParentScreenplayBlock(
  node: LexicalNode
): ScreenplayBlockNode | null {
  if ($isScreenplayBlockNode(node)) return node
  const parent = node.getParent()
  if (!parent) return null
  if ($isScreenplayBlockNode(parent)) return parent
  return null
}

// Change the type of an existing block. Preserves stable blockId and text.
export function replaceWithType(
  node: ScreenplayBlockNode,
  newType: BlockType
): void {
  const blockId = node.getBlockId()
  const position = node.getBlockPosition()
  const metadata = node.getBlockMetadata()
  const text = node.getTextContent()

  const stub: Block = {
    id: blockId,
    type: newType,
    text: '',
    position,
    metadata,
  }

  const newNode = $createNodeForBlock(stub)
  if (text) {
    newNode.append($createTextNode(text))
  }

  node.replace(newNode)
  newNode.selectEnd()
}

// Create a new empty block after the given node.
export function appendNewBlock(
  node: ScreenplayBlockNode,
  type: BlockType
): void {
  const stub: Block = {
    id: uuidv4(),
    type,
    text: '',
    position: node.getBlockPosition() + 1000,
  }
  const newNode = $createNodeForBlock(stub)
  node.insertAfter(newNode)
  newNode.select()
}

// Split a block at a text offset into two blocks.
export function splitBlock(
  node: ScreenplayBlockNode,
  offset: number,
  newType: BlockType
): void {
  const fullText = node.getTextContent()
  const beforeText = fullText.slice(0, offset)
  const afterText = fullText.slice(offset)

  node.clear()
  if (beforeText) {
    node.append($createTextNode(beforeText))
  }

  const stub: Block = {
    id: uuidv4(),
    type: newType,
    text: '',
    position: node.getBlockPosition() + 500,
  }
  const newNode = $createNodeForBlock(stub)
  if (afterText) {
    newNode.append($createTextNode(afterText))
  }

  node.insertAfter(newNode)
  newNode.selectStart()
}

// ─── Display block types ──────────────────────────────────────────────────────
//
// The dropdown uses "display types" which expand `section` into its named
// subtypes (act_start, act_end, etc.). Everything else maps 1:1 to BlockType.

export type DisplayBlockType =
  | Exclude<BlockType, 'section'>
  | 'section:act_start'
  | 'section:act_end'
  | 'section:sequence'
  | 'section:cold_open_start'
  | 'section:cold_open_end'

// Ordered list used to render the dropdown.
export const DISPLAY_BLOCK_TYPES: DisplayBlockType[] = [
  'scene_heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
  'section:act_start',
  'section:act_end',
  'section:sequence',
  'section:cold_open_start',
  'section:cold_open_end',
  'summary',
  'cold_open_marker',
]

export const DISPLAY_BLOCK_TYPE_LABELS: Record<DisplayBlockType, string> = {
  scene_heading:           'Scene Heading',
  action:                  'Action',
  character:               'Character',
  dialogue:                'Dialogue',
  parenthetical:           'Parenthetical',
  transition:              'Transition',
  shot:                    'Shot',
  'section:act_start':     'Act Start',
  'section:act_end':       'Act End',
  'section:sequence':      'Sequence',
  'section:cold_open_start': 'Cold Open Start',
  'section:cold_open_end':   'Cold Open End',
  summary:                 'Summary',
  cold_open_marker:        'Cold Open Marker',
}

// Read the display type from a node (checks metadata for section subtypes).
export function getDisplayBlockType(node: ScreenplayBlockNode): DisplayBlockType {
  const blockType = node.getBlockType()
  if (blockType !== 'section') return blockType as DisplayBlockType
  const meta = node.getBlockMetadata() as { section_type?: string } | undefined
  const sectionType = meta?.section_type
  if (
    sectionType === 'act_start' ||
    sectionType === 'act_end' ||
    sectionType === 'sequence' ||
    sectionType === 'cold_open_start' ||
    sectionType === 'cold_open_end'
  ) {
    return `section:${sectionType}`
  }
  return 'section:act_start' // fallback
}

// Convert a display type back to a Block stub (with metadata for sections).
export function replaceWithDisplayType(
  node: ScreenplayBlockNode,
  displayType: DisplayBlockType
): void {
  const blockId = node.getBlockId()
  const position = node.getBlockPosition()
  const text = node.getTextContent()

  let blockType: BlockType
  let metadata: Record<string, unknown> | undefined

  if (displayType.startsWith('section:')) {
    blockType = 'section'
    const sectionType = displayType.slice('section:'.length)
    metadata = { section_type: sectionType, level: 1 }
  } else {
    blockType = displayType as BlockType
    metadata = undefined
  }

  const stub: Block = { id: blockId, type: blockType, text: '', position, metadata }
  const newNode = $createNodeForBlock(stub)
  if (text) newNode.append($createTextNode(text))
  node.replace(newNode)
  newNode.selectEnd()
}
