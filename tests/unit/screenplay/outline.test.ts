import { describe, it, expect } from 'vitest'
import { deriveOutline } from '@/lib/screenplay/outline'
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

// ─── deriveOutline ────────────────────────────────────────────────────────────

describe('deriveOutline', () => {
  it('returns empty array for empty input', () => {
    expect(deriveOutline([])).toEqual([])
  })

  it('returns empty array when no scene_heading or section blocks exist', () => {
    const blocks = [
      block({ type: 'action', text: 'Some action.' }),
      block({ type: 'character', text: 'ALICE' }),
    ]
    expect(deriveOutline(blocks)).toEqual([])
  })

  it('returns flat scene nodes at root when there are no sections', () => {
    const h1 = block({ type: 'scene_heading', text: 'INT. ROOM — DAY' })
    const h2 = block({ type: 'scene_heading', text: 'EXT. PARK — NIGHT' })
    const nodes = deriveOutline([h1, h2])

    expect(nodes).toHaveLength(2)
    expect(nodes[0].type).toBe('scene')
    expect(nodes[1].type).toBe('scene')
  })

  it('assigns correct scene numbers to flat scenes', () => {
    const h1 = block({ type: 'scene_heading', text: 'INT. A — DAY' })
    const h2 = block({ type: 'scene_heading', text: 'INT. B — DAY' })
    const nodes = deriveOutline([h1, h2])

    expect(nodes[0].sceneNumber).toBe(1)
    expect(nodes[1].sceneNumber).toBe(2)
  })

  it('creates a section node for cold_open_marker', () => {
    const marker = block({ type: 'cold_open_marker', text: 'COLD OPEN' })
    const [node] = deriveOutline([marker])

    expect(node.type).toBe('section')
    expect(node.label).toBe('COLD OPEN')
    expect(node.children).toEqual([])
  })

  it('nests scenes under cold_open_marker', () => {
    const marker = block({ type: 'cold_open_marker', text: 'COLD OPEN' })
    const heading = block({ type: 'scene_heading', text: 'EXT. BEACH — DAY' })
    const [section] = deriveOutline([marker, heading])

    expect(section.children).toHaveLength(1)
    expect(section.children![0].type).toBe('scene')
    expect(section.children![0].id).toBe(heading.id)
  })

  it('creates a section node for section:act_start', () => {
    const actStart = block({
      type: 'section',
      text: 'ACT ONE',
      metadata: { section_type: 'act_start', level: 1 },
    })
    const [node] = deriveOutline([actStart])

    expect(node.type).toBe('section')
    expect(node.label).toBe('ACT ONE')
    expect(node.level).toBe(1)
  })

  it('nests scenes under their containing act', () => {
    const act = block({
      type: 'section',
      text: 'ACT ONE',
      metadata: { section_type: 'act_start', level: 1 },
    })
    const h1 = block({ type: 'scene_heading', text: 'INT. A — DAY' })
    const h2 = block({ type: 'scene_heading', text: 'EXT. B — NIGHT' })
    const [section] = deriveOutline([act, h1, h2])

    expect(section.children).toHaveLength(2)
  })

  it('puts a scene before any act at the root level', () => {
    const h1 = block({ type: 'scene_heading', text: 'EXT. COLD OPEN SCENE — NIGHT' })
    const act = block({
      type: 'section',
      text: 'ACT ONE',
      metadata: { section_type: 'act_start', level: 1 },
    })
    const h2 = block({ type: 'scene_heading', text: 'INT. ACT ONE SCENE — DAY' })
    const nodes = deriveOutline([h1, act, h2])

    // h1 is at root (no section yet); act is at root; h2 is under act
    expect(nodes).toHaveLength(2)
    expect(nodes[0].type).toBe('scene')
    expect(nodes[1].type).toBe('section')
    expect(nodes[1].children![0].id).toBe(h2.id)
  })

  it('ignores act_end blocks (not represented in outline)', () => {
    const act = block({
      type: 'section',
      text: 'ACT ONE',
      metadata: { section_type: 'act_start', level: 1 },
    })
    const actEnd = block({
      type: 'section',
      text: 'END OF ACT ONE',
      metadata: { section_type: 'act_end', level: 1 },
    })
    const heading = block({ type: 'scene_heading', text: 'INT. SCENE — DAY' })
    const nodes = deriveOutline([act, heading, actEnd])

    // Only the act_start section should appear
    expect(nodes).toHaveLength(1)
    expect(nodes[0].label).toBe('ACT ONE')
  })

  it('attaches description from first action block', () => {
    const heading = block({ type: 'scene_heading', text: 'INT. ROOM — DAY' })
    const action = block({ type: 'action', text: 'She enters and looks around.' })
    const [node] = deriveOutline([heading, action])

    expect(node.description).toBe('She enters and looks around.')
  })

  it('prefers summary block over action for description', () => {
    const heading = block({ type: 'scene_heading', text: 'INT. ROOM — DAY' })
    const action = block({ type: 'action', text: 'The room is dark.' })
    const summary = block({ type: 'summary', text: 'Alice discovers the key is missing.' })
    const [node] = deriveOutline([heading, action, summary])

    expect(node.description).toBe('Alice discovers the key is missing.')
  })

  it('omits description when no action or summary follows the scene', () => {
    const heading = block({ type: 'scene_heading', text: 'INT. EMPTY — DAY' })
    const char = block({ type: 'character', text: 'ALICE' })
    const [node] = deriveOutline([heading, char])

    expect(node.description).toBeUndefined()
  })

  it('correctly derives 2-level outline from DEMO_BLOCKS', () => {
    const nodes = deriveOutline(DEMO_BLOCKS)

    // Top level: cold open section + act one section
    expect(nodes).toHaveLength(2)

    const coldOpen = nodes[0]
    expect(coldOpen.type).toBe('section')
    expect(coldOpen.label).toBe('COLD OPEN')
    expect(coldOpen.children).toHaveLength(1)
    expect(coldOpen.children![0].sceneNumber).toBe(1)
    expect(coldOpen.children![0].id).toBe('00000000-0000-0000-0000-000000000002')

    const actOne = nodes[1]
    expect(actOne.type).toBe('section')
    expect(actOne.label).toBe('ACT ONE')
    expect(actOne.children).toHaveLength(1)
    expect(actOne.children![0].sceneNumber).toBe(2)
    expect(actOne.children![0].id).toBe('00000000-0000-0000-0000-000000000018')
  })

  it('scene description for scene 2 in DEMO_BLOCKS comes from the summary block', () => {
    const nodes = deriveOutline(DEMO_BLOCKS)
    const scene2 = nodes[1].children![0]
    // Block 20 is a summary block in scene 2
    expect(scene2.description).toBe(
      "Mara discovers the old logbook entry that connects the signal anomaly to an event from 1943."
    )
  })
})
