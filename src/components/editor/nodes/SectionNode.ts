import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType, SectionType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class SectionNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'section'
  }

  static clone(node: SectionNode): SectionNode {
    return new SectionNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): SectionNode {
    const node = new SectionNode(
      json.blockId,
      json.blockPosition,
      json.blockMetadata
    )
    node.setFormat(json.format)
    node.setIndent(json.indent)
    node.setDirection(json.direction)
    return node
  }

  getCSSClass(): string {
    const meta = this.__blockMetadata as { section_type?: SectionType } | undefined
    const sectionType = meta?.section_type ?? 'act_start'
    // Add a CSS modifier based on section type for styling
    return `sp-section sp-section--${sectionType}`
  }

  getBlockType(): BlockType {
    return 'section'
  }
}

export function $createSectionNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): SectionNode {
  return $applyNodeReplacement(
    new SectionNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isSectionNode(node: unknown): node is SectionNode {
  return node instanceof SectionNode
}
