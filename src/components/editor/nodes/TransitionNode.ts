import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class TransitionNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'transition'
  }

  static clone(node: TransitionNode): TransitionNode {
    return new TransitionNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): TransitionNode {
    const node = new TransitionNode(
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
    return 'sp-transition'
  }

  getBlockType(): BlockType {
    return 'transition'
  }
}

export function $createTransitionNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): TransitionNode {
  return $applyNodeReplacement(
    new TransitionNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isTransitionNode(node: unknown): node is TransitionNode {
  return node instanceof TransitionNode
}
