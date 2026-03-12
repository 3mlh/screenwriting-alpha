import { describe, it, expect } from 'vitest'
import {
  blockSchema,
  blocksSchema,
  validateBlock,
  validateBlocks,
  safeValidateBlocks,
} from '@/lib/validation/block.schema'
import type { Block } from '@/types/screenplay'
import { BLOCK_TYPES } from '@/types/screenplay'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validBlock: Block = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  type: 'scene_heading',
  text: 'INT. COFFEE SHOP — DAY',
  position: 1000,
}

// ─── blockSchema ──────────────────────────────────────────────────────────────

describe('blockSchema', () => {
  it('accepts a valid block', () => {
    expect(() => validateBlock(validBlock)).not.toThrow()
  })

  it('accepts all block types', () => {
    for (const type of BLOCK_TYPES) {
      const block = { ...validBlock, type }
      expect(() => validateBlock(block)).not.toThrow()
    }
  })

  it('accepts an empty text string', () => {
    expect(() => validateBlock({ ...validBlock, text: '' })).not.toThrow()
  })

  it('accepts optional metadata', () => {
    const withMeta: Block = {
      ...validBlock,
      metadata: { int_ext: 'INT', location: 'COFFEE SHOP' },
    }
    expect(() => validateBlock(withMeta)).not.toThrow()
  })

  it('rejects an invalid UUID', () => {
    const bad = { ...validBlock, id: 'not-a-uuid' }
    expect(() => validateBlock(bad)).toThrow()
  })

  it('rejects an unknown block type', () => {
    const bad = { ...validBlock, type: 'monologue' }
    expect(() => validateBlock(bad)).toThrow()
  })

  it('rejects a negative position', () => {
    const bad = { ...validBlock, position: -1 }
    expect(() => validateBlock(bad)).toThrow()
  })

  it('rejects a float position', () => {
    const bad = { ...validBlock, position: 1000.5 }
    expect(() => validateBlock(bad)).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => validateBlock({ id: validBlock.id, type: 'action' })).toThrow()
  })
})

// ─── blocksSchema ─────────────────────────────────────────────────────────────

describe('blocksSchema', () => {
  it('accepts an empty array', () => {
    expect(() => validateBlocks([])).not.toThrow()
  })

  it('accepts an array of valid blocks', () => {
    const blocks: Block[] = [
      { ...validBlock, position: 1000 },
      { ...validBlock, id: '123e4567-e89b-12d3-a456-426614174001', type: 'action', position: 2000 },
      { ...validBlock, id: '123e4567-e89b-12d3-a456-426614174002', type: 'character', position: 3000 },
    ]
    expect(() => validateBlocks(blocks)).not.toThrow()
  })

  it('rejects an array containing an invalid block', () => {
    const blocks = [
      validBlock,
      { id: 'bad-uuid', type: 'action', text: 'hello', position: 2000 },
    ]
    expect(() => validateBlocks(blocks)).toThrow()
  })
})

// ─── safeValidateBlocks ───────────────────────────────────────────────────────

describe('safeValidateBlocks', () => {
  it('returns success=true with valid data', () => {
    const result = safeValidateBlocks([validBlock])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data[0].id).toBe(validBlock.id)
    }
  })

  it('returns success=false with invalid data', () => {
    const result = safeValidateBlocks([{ id: 'bad' }])
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors.length).toBeGreaterThan(0)
    }
  })
})
