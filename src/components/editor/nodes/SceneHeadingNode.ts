import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class SceneHeadingNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'scene_heading'
  }

  static clone(node: SceneHeadingNode): SceneHeadingNode {
    return new SceneHeadingNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): SceneHeadingNode {
    const node = new SceneHeadingNode(
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
    return 'sp-scene-heading'
  }

  getBlockType(): BlockType {
    return 'scene_heading'
  }
}

export function $createSceneHeadingNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): SceneHeadingNode {
  return $applyNodeReplacement(
    new SceneHeadingNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isSceneHeadingNode(
  node: unknown
): node is SceneHeadingNode {
  return node instanceof SceneHeadingNode
}
