import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class CharacterNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'character'
  }

  static clone(node: CharacterNode): CharacterNode {
    return new CharacterNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): CharacterNode {
    const node = new CharacterNode(
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
    return 'sp-character'
  }

  getBlockType(): BlockType {
    return 'character'
  }
}

export function $createCharacterNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): CharacterNode {
  return $applyNodeReplacement(
    new CharacterNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isCharacterNode(node: unknown): node is CharacterNode {
  return node instanceof CharacterNode
}
