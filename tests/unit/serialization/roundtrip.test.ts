import { describe, it, expect, beforeEach } from 'vitest'
import { createEditor, $getRoot, $createTextNode } from 'lexical'
import { SCREENPLAY_NODES } from '@/components/editor/ScreenplayNodes'
import { lexicalToBlocks } from '@/components/editor/serialization/lexicalToBlocks'
import { $loadBlocksIntoEditor, $createNodeForBlock } from '@/components/editor/serialization/blocksToLexical'
import { validateBlocks } from '@/lib/validation/block.schema'
import { DEMO_BLOCKS } from '@/lib/demo/demoScript'
import type { Block } from '@/types/screenplay'

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeEditor() {
  return createEditor({
    nodes: SCREENPLAY_NODES,
    namespace: 'test',
    onError: (err) => { throw err },
  })
}

function loadAndRead(blocks: Block[]): Block[] {
  const editor = makeEditor()

  editor.update(
    () => { $loadBlocksIntoEditor(blocks) },
    { discrete: true }
  )

  return lexicalToBlocks(editor.getEditorState())
}

// ─── Round-trip: Block[] → Lexical → Block[] ──────────────────────────────────

describe('round-trip serialization', () => {
  it('preserves block count', () => {
    const result = loadAndRead(DEMO_BLOCKS)
    expect(result).toHaveLength(DEMO_BLOCKS.length)
  })

  it('preserves block ids (stable UUIDs)', () => {
    const result = loadAndRead(DEMO_BLOCKS)
    const resultIds = result.map((b) => b.id)
    const originalIds = DEMO_BLOCKS.map((b) => b.id)
    expect(resultIds).toEqual(originalIds)
  })

  it('preserves block types', () => {
    const result = loadAndRead(DEMO_BLOCKS)
    const resultTypes = result.map((b) => b.type)
    const originalTypes = DEMO_BLOCKS.map((b) => b.type)
    expect(resultTypes).toEqual(originalTypes)
  })

  it('preserves block text content', () => {
    const result = loadAndRead(DEMO_BLOCKS)
    for (let i = 0; i < DEMO_BLOCKS.length; i++) {
      expect(result[i].text).toBe(DEMO_BLOCKS[i].text)
    }
  })

  it('produces output that passes Zod schema validation', () => {
    const result = loadAndRead(DEMO_BLOCKS)
    expect(() => validateBlocks(result)).not.toThrow()
  })

  it('round-trips an empty block array with a fallback scene heading', () => {
    const result = loadAndRead([])
    // $loadBlocksIntoEditor inserts a default scene heading when blocks is empty
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('scene_heading')
    expect(result[0].id).toBeTruthy()
  })

  it('handles all block types', () => {
    const allTypes: Block[] = [
      { id: '00000000-0000-0000-0001-000000000001', type: 'scene_heading', text: 'INT. TEST — DAY', position: 1000 },
      { id: '00000000-0000-0000-0001-000000000002', type: 'action', text: 'Action line.', position: 2000 },
      { id: '00000000-0000-0000-0001-000000000003', type: 'character', text: 'CHARACTER', position: 3000 },
      { id: '00000000-0000-0000-0001-000000000004', type: 'dialogue', text: 'Hello there.', position: 4000 },
      { id: '00000000-0000-0000-0001-000000000005', type: 'parenthetical', text: '(quietly)', position: 5000 },
      { id: '00000000-0000-0000-0001-000000000006', type: 'transition', text: 'CUT TO:', position: 6000 },
      { id: '00000000-0000-0000-0001-000000000007', type: 'shot', text: 'CLOSE ON: the door.', position: 7000 },
      { id: '00000000-0000-0000-0001-000000000008', type: 'section', text: 'ACT TWO', position: 8000, metadata: { section_type: 'act_start', level: 1 } },
      { id: '00000000-0000-0000-0001-000000000009', type: 'summary', text: 'Scene summary here.', position: 9000 },
      { id: '00000000-0000-0000-0001-000000000010', type: 'cold_open_marker', text: 'COLD OPEN', position: 10000 },
    ]

    const result = loadAndRead(allTypes)
    expect(result).toHaveLength(10)

    for (let i = 0; i < allTypes.length; i++) {
      expect(result[i].type).toBe(allTypes[i].type)
      expect(result[i].id).toBe(allTypes[i].id)
      expect(result[i].text).toBe(allTypes[i].text)
    }
  })
})

// ─── $createNodeForBlock ──────────────────────────────────────────────────────

describe('$createNodeForBlock', () => {
  it('creates a node with the correct block type', () => {
    const editor = makeEditor()

    editor.update(
      () => {
        const root = $getRoot()
        const block: Block = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          type: 'dialogue',
          text: 'Hello.',
          position: 1000,
        }
        const node = $createNodeForBlock(block)
        root.append(node)

        expect(node.getBlockId()).toBe(block.id)
        expect(node.getBlockType()).toBe('dialogue')
      },
      { discrete: true }
    )
  })

  it('throws for unknown block type', () => {
    const editor = makeEditor()

    editor.update(
      () => {
        expect(() => {
          // @ts-expect-error — testing unknown type
          $createNodeForBlock({ id: 'abc', type: 'unknown', text: '', position: 0 })
        }).toThrow()
      },
      { discrete: true }
    )
  })
})

// ─── Stable UUIDs ─────────────────────────────────────────────────────────────

describe('stable UUIDs', () => {
  it('UUID does not change after second round-trip', () => {
    const firstPass = loadAndRead(DEMO_BLOCKS)
    const secondPass = loadAndRead(firstPass)

    for (let i = 0; i < firstPass.length; i++) {
      expect(secondPass[i].id).toBe(firstPass[i].id)
    }
  })

  it('each block has a unique id', () => {
    const result = loadAndRead(DEMO_BLOCKS)
    const ids = result.map((b) => b.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(result.length)
  })
})
