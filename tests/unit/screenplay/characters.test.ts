import { describe, it, expect } from 'vitest'
import { deriveCharacterStats } from '@/lib/screenplay/characters'
import { DEMO_BLOCKS } from '@/lib/demo/demoScript'
import type { Block } from '@/types/screenplay'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _pos = 1000
function block(overrides: Partial<Block> & { type: Block['type'] }): Block {
  return {
    id: crypto.randomUUID(),
    text: '',
    position: (_pos += 1000),
    ...overrides,
  }
}

function sceneHeading(text = 'INT. ROOM — DAY'): Block {
  return block({ type: 'scene_heading', text })
}

// ─── deriveCharacterStats ─────────────────────────────────────────────────────

describe('deriveCharacterStats', () => {
  it('returns empty array for empty input', () => {
    expect(deriveCharacterStats([])).toEqual([])
  })

  it('returns empty array when there are no dialogue blocks', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'action', text: 'Action.' }),
      block({ type: 'character', text: 'ALICE' }),
    ]
    expect(deriveCharacterStats(blocks)).toEqual([])
  })

  it('creates a stat entry only when a character has at least one dialogue block', () => {
    const blocks = [
      block({ type: 'character', text: 'ALICE' }),
      // no dialogue follows — Alice should not appear in results
    ]
    expect(deriveCharacterStats(blocks)).toEqual([])
  })

  it('counts a single dialogue block correctly', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Hello world.' }),
    ]
    const [stats] = deriveCharacterStats(blocks)
    expect(stats.name).toBe('ALICE')
    expect(stats.dialogueCount).toBe(1)
    expect(stats.wordCount).toBe(2)
    expect(stats.sceneCount).toBe(1)
  })

  it('accumulates multiple dialogue blocks for the same character', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Line one.' }),
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Line two.' }),
    ]
    const [stats] = deriveCharacterStats(blocks)
    expect(stats.dialogueCount).toBe(2)
    expect(stats.wordCount).toBe(4) // "Line one" + "Line two"
  })

  it('parenthetical between character and dialogue does not break attribution', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'character', text: 'BOB' }),
      block({ type: 'parenthetical', text: '(to himself)' }),
      block({ type: 'dialogue', text: 'I see.' }),
    ]
    const [stats] = deriveCharacterStats(blocks)
    expect(stats.name).toBe('BOB')
    expect(stats.dialogueCount).toBe(1)
  })

  it('action block resets the current character', () => {
    const alice = block({ type: 'character', text: 'ALICE' })
    const action = block({ type: 'action', text: 'Some action.' })
    // dialogue after an action, with no preceding character block → not attributed
    const orphanDialogue = block({ type: 'dialogue', text: 'Who said this?' })

    const stats = deriveCharacterStats([sceneHeading(), alice, action, orphanDialogue])
    expect(stats).toEqual([])
  })

  it('counts distinct scenes correctly', () => {
    const scene1 = sceneHeading('INT. ROOM — DAY')
    const scene2 = sceneHeading('EXT. PARK — NIGHT')
    const blocks = [
      scene1,
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Hello.' }),
      scene2,
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Goodbye.' }),
    ]
    const [stats] = deriveCharacterStats(blocks)
    expect(stats.name).toBe('ALICE')
    expect(stats.sceneCount).toBe(2)
    expect(stats.sceneIds).toContain(scene1.id)
    expect(stats.sceneIds).toContain(scene2.id)
  })

  it('does not double-count a scene when a character speaks multiple times in it', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'First.' }),
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Second.' }),
    ]
    const [stats] = deriveCharacterStats(blocks)
    expect(stats.sceneCount).toBe(1)
  })

  it('tracks multiple characters independently', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Hello.' }),
      block({ type: 'character', text: 'BOB' }),
      block({ type: 'dialogue', text: 'Hi there.' }),
      block({ type: 'character', text: 'BOB' }),
      block({ type: 'dialogue', text: 'Nice day.' }),
    ]
    const stats = deriveCharacterStats(blocks)
    const alice = stats.find(s => s.name === 'ALICE')!
    const bob = stats.find(s => s.name === 'BOB')!

    expect(alice.dialogueCount).toBe(1)
    expect(bob.dialogueCount).toBe(2)
  })

  it('normalizes character names to uppercase', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'character', text: 'alice' }),
      block({ type: 'dialogue', text: 'Hello.' }),
    ]
    const [stats] = deriveCharacterStats(blocks)
    expect(stats.name).toBe('ALICE')
  })

  it('counts words correctly across dialogue blocks', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'One two three.' }),   // 3 words
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Four five.' }),        // 2 words
    ]
    const [stats] = deriveCharacterStats(blocks)
    expect(stats.wordCount).toBe(5)
  })

  it('sorts results by dialogueCount descending', () => {
    const blocks = [
      sceneHeading(),
      block({ type: 'character', text: 'MINOR' }),
      block({ type: 'dialogue', text: 'One line.' }),
      block({ type: 'character', text: 'LEAD' }),
      block({ type: 'dialogue', text: 'First.' }),
      block({ type: 'character', text: 'LEAD' }),
      block({ type: 'dialogue', text: 'Second.' }),
      block({ type: 'character', text: 'LEAD' }),
      block({ type: 'dialogue', text: 'Third.' }),
    ]
    const stats = deriveCharacterStats(blocks)
    expect(stats[0].name).toBe('LEAD')
    expect(stats[1].name).toBe('MINOR')
  })

  it('correctly stats ALDRIC and KAEL from DEMO_BLOCKS', () => {
    const stats = deriveCharacterStats(DEMO_BLOCKS)
    const aldric = stats.find(s => s.name === 'ALDRIC')!
    const kael = stats.find(s => s.name === 'KAEL')!

    expect(aldric).toBeDefined()
    expect(kael).toBeDefined()

    // Both have 2 dialogue blocks in scene 1 only
    expect(aldric.dialogueCount).toBe(2)
    expect(aldric.sceneCount).toBe(1)
    expect(kael.dialogueCount).toBe(2)
    expect(kael.sceneCount).toBe(1)

    // ALDRIC: "That's not possible." (3) + "Islands don't disappear." (3) = 6
    expect(aldric.wordCount).toBe(6)
    // KAEL's first line is longer
    expect(kael.wordCount).toBeGreaterThan(aldric.wordCount)
  })
})
