import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class DialogueNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'dialogue'
  }

  static clone(node: DialogueNode): DialogueNode {
    return new DialogueNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): DialogueNode {
    const node = new DialogueNode(
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
    return 'sp-dialogue'
  }

  getBlockType(): BlockType {
    return 'dialogue'
  }
}

export function $createDialogueNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): DialogueNode {
  return $applyNodeReplacement(
    new DialogueNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isDialogueNode(node: unknown): node is DialogueNode {
  return node instanceof DialogueNode
}
