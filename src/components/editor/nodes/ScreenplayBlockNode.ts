import {
  ElementNode,
  LexicalNode,
  SerializedElementNode,
  Spread,
  NodeKey,
} from 'lexical'
import type { BlockType } from '@/types/screenplay'

// ─── Serialized form ──────────────────────────────────────────────────────────

export type SerializedScreenplayBlockNode = Spread<
  {
    blockId: string
    blockPosition: number
    blockMetadata?: Record<string, unknown>
  },
  SerializedElementNode
>

// ─── Base class ───────────────────────────────────────────────────────────────
//
// All screenplay block node types extend this. It stores the stable blockId
// (UUID) that survives editing. The Lexical-internal __key must NOT be used
// as the block id — Lexical regenerates keys; we need stability for diffing.

export abstract class ScreenplayBlockNode extends ElementNode {
  __blockId: string
  __blockPosition: number
  __blockMetadata?: Record<string, unknown>

  constructor(
    blockId: string,
    blockPosition: number,
    blockMetadata?: Record<string, unknown>,
    key?: NodeKey
  ) {
    super(key)
    this.__blockId = blockId
    this.__blockPosition = blockPosition
    this.__blockMetadata = blockMetadata
  }

  // ── Subclass contract ────────────────────────────────────────────────────

  // Each subclass must declare its CSS class here. Used in createDOM.
  abstract getCSSClass(): string

  // The BlockType string this node represents (must match static getType()).
  abstract getBlockType(): BlockType

  // ── DOM ───────────────────────────────────────────────────────────────────

  createDOM(/* config */): HTMLElement {
    const el = document.createElement('div')
    el.className = `sp-block ${this.getCSSClass()}`
    // Store the block id on the DOM for debugging / test queries
    el.dataset.blockId = this.__blockId
    el.dataset.blockType = this.getBlockType()
    return el
  }

  updateDOM(
    prevNode: ScreenplayBlockNode,
    dom: HTMLElement
  ): boolean {
    // Only rebuild the DOM if the CSS class changes (shouldn't happen since
    // type changes are handled by node replacement, not mutation).
    const prevClass = `sp-block ${prevNode.getCSSClass()}`
    const nextClass = `sp-block ${this.getCSSClass()}`
    if (prevClass !== nextClass) {
      dom.className = nextClass
    }
    return false
  }

  // ── Lexical behavior ─────────────────────────────────────────────────────

  isInline(): boolean {
    return false
  }

  // Prevent Lexical from merging adjacent nodes of the same type.
  // Each screenplay block is atomic.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canMergeWith(_node: LexicalNode): boolean {
    return false
  }

  // ── Accessors (used by serialization and plugins) ─────────────────────────

  getBlockId(): string {
    const self = this.getLatest()
    return self.__blockId
  }

  getBlockPosition(): number {
    const self = this.getLatest()
    return self.__blockPosition
  }

  getBlockMetadata(): Record<string, unknown> | undefined {
    const self = this.getLatest()
    return self.__blockMetadata
  }

  setBlockId(id: string): this {
    const self = this.getWritable()
    self.__blockId = id
    return self
  }

  setBlockPosition(position: number): this {
    const self = this.getWritable()
    self.__blockPosition = position
    return self
  }

  setBlockMetadata(metadata: Record<string, unknown> | undefined): this {
    const self = this.getWritable()
    self.__blockMetadata = metadata
    return self
  }

  // ── JSON serialization ────────────────────────────────────────────────────

  exportJSON(): SerializedScreenplayBlockNode {
    return {
      ...super.exportJSON(),
      type: this.getBlockType(),
      blockId: this.__blockId,
      blockPosition: this.__blockPosition,
      blockMetadata: this.__blockMetadata,
      version: 1,
    }
  }

  // importJSON is implemented in each concrete subclass because TypeScript
  // requires static methods to be defined on the actual class, not a base.
}

// ─── Helper: extract block id from a node key in a read ─────────────────────

export function $isScreenplayBlockNode(
  node: LexicalNode | null | undefined
): node is ScreenplayBlockNode {
  return node instanceof ScreenplayBlockNode
}
