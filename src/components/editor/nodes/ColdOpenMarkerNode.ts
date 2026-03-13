import { $applyNodeReplacement } from 'lexical'
import {
  ScreenplayBlockNode,
  SerializedScreenplayBlockNode,
} from './ScreenplayBlockNode'
import type { BlockType } from '@/types/screenplay'
import { v4 as uuidv4 } from 'uuid'

export class ColdOpenMarkerNode extends ScreenplayBlockNode {
  static getType(): string {
    return 'cold_open_marker'
  }

  static clone(node: ColdOpenMarkerNode): ColdOpenMarkerNode {
    return new ColdOpenMarkerNode(
      node.__blockId,
      node.__blockPosition,
      node.__blockMetadata,
      node.__key
    )
  }

  static importJSON(json: SerializedScreenplayBlockNode): ColdOpenMarkerNode {
    const node = new ColdOpenMarkerNode(
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
    return 'sp-cold-open-marker'
  }

  getBlockType(): BlockType {
    return 'cold_open_marker'
  }
}

export function $createColdOpenMarkerNode(
  blockId?: string,
  blockPosition = 0,
  blockMetadata?: Record<string, unknown>
): ColdOpenMarkerNode {
  return $applyNodeReplacement(
    new ColdOpenMarkerNode(blockId ?? uuidv4(), blockPosition, blockMetadata)
  )
}

export function $isColdOpenMarkerNode(
  node: unknown
): node is ColdOpenMarkerNode {
  return node instanceof ColdOpenMarkerNode
}
