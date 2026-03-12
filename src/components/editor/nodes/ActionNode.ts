import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class ActionNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'action'
  }

  static clone(node: ActionNode): ActionNode {
    return new ActionNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): ActionNode {
    const node = new ActionNode(
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
    return 'sp-action'
  }

  getBlockType(): BlockType {
    return 'action'
  }
}

export function $createActionNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): ActionNode {
  return $applyNodeReplacement(
    new ActionNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isActionNode(node: unknown): node is ActionNode {
  return node instanceof ActionNode
}
