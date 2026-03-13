import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class SummaryNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'summary'
  }

  static clone(node: SummaryNode): SummaryNode {
    return new SummaryNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): SummaryNode {
    const node = new SummaryNode(
      json.blockId,
      json.blockPosition,
      json.blockMetadata
    )
    node.setFormat(json.format)
    node.setIndent(json.indent)
    node.setDirection(json.direction)
    return node
  }

  exportJSON(): SerializedScreenplayBlockNode {
    return super.exportJSON()
  }

  getCSSClass(): string {
    return 'sp-summary'
  }

  getBlockType(): BlockType {
    return 'summary'
  }
}

export function $createSummaryNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): SummaryNode {
  return $applyNodeReplacement(
    new SummaryNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isSummaryNode(node: unknown): node is SummaryNode {
  return node instanceof SummaryNode
}
