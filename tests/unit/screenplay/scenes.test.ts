import { describe, it, expect } from 'vitest'
import { deriveScenes, parseSceneHeading } from '@/lib/screenplay/scenes'
import { DEMO_BLOCKS } from '@/lib/demo/demoScript'
import type { Block } from '@/types/screenplay'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function block(overrides: Partial<Block> & { type: Block['type'] }): Block {
  return {
    id: crypto.randomUUID(),
    text: '',
    position: 1000,
    ...overrides,
  }
}

// ─── parseSceneHeading ────────────────────────────────────────────────────────

describe('parseSceneHeading', () => {
  it('parses EXT with single separator', () => {
    expect(parseSceneHeading('EXT. LIGHTHOUSE GALLERY — NIGHT')).toEqual({
      int_ext: 'EXT',
      location: 'LIGHTHOUSE GALLERY',
      time_of_day: 'NIGHT',
    })
  })

  it('parses INT with nested dashes in location (last separator is time)', () => {
    expect(parseSceneHeading('INT. LIGHTHOUSE — LOWER LEVEL — LATER')).toEqual({
      int_ext: 'INT',
      location: 'LIGHTHOUSE — LOWER LEVEL',
      time_of_day: 'LATER',
    })
  })

  it('parses INT/EXT', () => {
    const result = parseSceneHeading('INT/EXT. FARMHOUSE — DAY')
    expect(result.int_ext).toBe('INT/EXT')
    expect(result.location).toBe('FARMHOUSE')
    expect(result.time_of_day).toBe('DAY')
  })

  it('parses EXT/INT', () => {
    const result = parseSceneHeading('EXT/INT. CAR — CONTINUOUS')
    expect(result.int_ext).toBe('EXT/INT')
    expect(result.time_of_day).toBe('CONTINUOUS')
  })

  it('parses heading with no time separator (location only)', () => {
    const result = parseSceneHeading('INT. HALLWAY')
    expect(result.int_ext).toBe('INT')
    expect(result.location).toBe('HALLWAY')
    expect(result.time_of_day).toBeUndefined()
  })

  it('returns empty object for heading with no INT/EXT prefix', () => {
    expect(parseSceneHeading('SOMEWHERE OVER THE RAINBOW')).toEqual({})
  })

  it('is case-insensitive for the prefix', () => {
    const result = parseSceneHeading('int. office — night')
    expect(result.int_ext).toBe('INT')
    expect(result.location).toBe('OFFICE')
    expect(result.time_of_day).toBe('NIGHT')
  })

  it('handles hyphen-minus separator as well as em-dash', () => {
    const result = parseSceneHeading('EXT. ROOFTOP - DUSK')
    expect(result.location).toBe('ROOFTOP')
    expect(result.time_of_day).toBe('DUSK')
  })
})

// ─── deriveScenes ─────────────────────────────────────────────────────────────

describe('deriveScenes', () => {
  it('returns empty array for empty input', () => {
    expect(deriveScenes([])).toEqual([])
  })

  it('returns empty array when there are no scene_heading blocks', () => {
    const blocks = [
      block({ type: 'action', text: 'Some action.' }),
      block({ type: 'character', text: 'ALICE' }),
      block({ type: 'dialogue', text: 'Hello.' }),
    ]
    expect(deriveScenes(blocks)).toEqual([])
  })

  it('returns one scene for a single scene_heading', () => {
    const heading = block({ type: 'scene_heading', text: 'INT. ROOM — DAY' })
    const scenes = deriveScenes([heading])
    expect(scenes).toHaveLength(1)
    expect(scenes[0].id).toBe(heading.id)
    expect(scenes[0].sceneNumber).toBe(1)
    expect(scenes[0].blocks).toEqual([])
  })

  it('assigns the heading block as the heading property', () => {
    const heading = block({ type: 'scene_heading', text: 'EXT. PARK — MORNING' })
    const [scene] = deriveScenes([heading])
    expect(scene.heading).toBe(heading)
  })

  it('collects body blocks under their scene', () => {
    const heading = block({ type: 'scene_heading', text: 'INT. OFFICE — DAY' })
    const action = block({ type: 'action', text: 'She enters.' })
    const char = block({ type: 'character', text: 'ALICE' })
    const dialogue = block({ type: 'dialogue', text: 'Hello.' })

    const [scene] = deriveScenes([heading, action, char, dialogue])
    expect(scene.blocks).toEqual([action, char, dialogue])
  })

  it('splits body blocks correctly between two scenes', () => {
    const h1 = block({ type: 'scene_heading', text: 'INT. ROOM — DAY' })
    const a1 = block({ type: 'action', text: 'First action.' })
    const h2 = block({ type: 'scene_heading', text: 'EXT. PARK — NIGHT' })
    const a2 = block({ type: 'action', text: 'Second action.' })

    const scenes = deriveScenes([h1, a1, h2, a2])
    expect(scenes).toHaveLength(2)
    expect(scenes[0].blocks).toEqual([a1])
    expect(scenes[1].blocks).toEqual([a2])
  })

  it('assigns sequential 1-based scene numbers', () => {
    const blocks = [
      block({ type: 'scene_heading', text: 'INT. A — DAY' }),
      block({ type: 'scene_heading', text: 'INT. B — DAY' }),
      block({ type: 'scene_heading', text: 'INT. C — DAY' }),
    ]
    const scenes = deriveScenes(blocks)
    expect(scenes.map(s => s.sceneNumber)).toEqual([1, 2, 3])
  })

  it('sets startPosition from scene_heading block position', () => {
    const heading = block({ type: 'scene_heading', position: 5000 })
    const [scene] = deriveScenes([heading])
    expect(scene.startPosition).toBe(5000)
  })

  it('ignores non-scene blocks that appear before the first scene_heading', () => {
    const preamble = block({ type: 'action', text: 'A preamble action.' })
    const heading = block({ type: 'scene_heading', text: 'INT. ROOM — DAY' })
    const scenes = deriveScenes([preamble, heading])
    expect(scenes).toHaveLength(1)
    expect(scenes[0].blocks).toEqual([])
  })

  it('correctly derives 2 scenes from DEMO_BLOCKS', () => {
    const scenes = deriveScenes(DEMO_BLOCKS)
    expect(scenes).toHaveLength(2)
    expect(scenes[0].sceneNumber).toBe(1)
    expect(scenes[0].id).toBe('00000000-0000-0000-0000-000000000002')
    expect(scenes[1].sceneNumber).toBe(2)
    expect(scenes[1].id).toBe('00000000-0000-0000-0000-000000000018')
  })
})
