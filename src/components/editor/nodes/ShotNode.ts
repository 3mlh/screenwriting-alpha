import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class ShotNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'shot'
  }

  static clone(node: ShotNode): ShotNode {
    return new ShotNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): ShotNode {
    const node = new ShotNode(
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
    return 'sp-shot'
  }

  getBlockType(): BlockType {
    return 'shot'
  }
}

export function $createShotNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): ShotNode {
  return $applyNodeReplacement(
    new ShotNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isShotNode(node: unknown): node is ShotNode {
  return node instanceof ShotNode
}
