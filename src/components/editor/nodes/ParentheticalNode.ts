import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class ParentheticalNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'parenthetical'
  }

  static clone(node: ParentheticalNode): ParentheticalNode {
    return new ParentheticalNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): ParentheticalNode {
    const node = new ParentheticalNode(
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
    return 'sp-parenthetical'
  }

  getBlockType(): BlockType {
    return 'parenthetical'
  }
}

export function $createParentheticalNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): ParentheticalNode {
  return $applyNodeReplacement(
    new ParentheticalNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isParentheticalNode(
  node: unknown
): node is ParentheticalNode {
  return node instanceof ParentheticalNode
}
