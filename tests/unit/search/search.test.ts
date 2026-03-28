import { describe, expect, it } from 'vitest'
import type { Block } from '@/types/screenplay'
import { buildScriptSearchChunks, normalizeForSearch, serializeSearchChunksForRpc } from '@/lib/search/index'
import { analyzeSearchQuery, buildSearchSnippet, rankSearchCandidates } from '@/lib/search/search'
import type { SearchCandidate } from '@/lib/search/types'

let position = 0

function block(overrides: Partial<Block> & { type: Block['type']; text: string }): Block {
  position += 1000
  return {
    id: crypto.randomUUID(),
    position,
    metadata: undefined,
    ...overrides,
  }
}

describe('buildScriptSearchChunks', () => {
  it('derives scene and speaker context for dialogue rows', () => {
    const blocks = [
      block({
        type: 'section',
        text: 'ACT ONE',
        metadata: { section_type: 'act_start', label: 'Act One' },
      }),
      block({ type: 'scene_heading', text: 'INT. LIVING ROOM - DAY' }),
      block({ type: 'character', text: 'LUCILLE' }),
      block({ type: 'dialogue', text: 'I do not understand the question, and I will not respond to it.' }),
      block({ type: 'action', text: 'Michael stares at her in disbelief.' }),
    ]

    const rows = buildScriptSearchChunks(blocks)
    const dialogueRow = rows.find((row) => row.blockType === 'dialogue')

    expect(dialogueRow?.actLabel).toBe('Act One')
    expect(dialogueRow?.sceneLabel).toBe('INT. LIVING ROOM - DAY')
    expect(dialogueRow?.speaker).toBe('LUCILLE')
    expect(dialogueRow?.searchText).toContain(normalizeForSearch('act one'))
    expect(dialogueRow?.searchText).toContain(normalizeForSearch('living room'))
    expect(dialogueRow?.searchText).toContain(normalizeForSearch('lucille'))
  })

  it('clears the current speaker when action interrupts dialogue', () => {
    const blocks = [
      block({ type: 'scene_heading', text: 'INT. OFFICE - DAY' }),
      block({ type: 'character', text: 'MICHAEL' }),
      block({ type: 'dialogue', text: 'We need to leave.' }),
      block({ type: 'action', text: 'He grabs the folder.' }),
      block({ type: 'dialogue', text: 'Now.' }),
    ]

    const rows = buildScriptSearchChunks(blocks)
    const trailingDialogue = rows.filter((row) => row.blockType === 'dialogue')[1]

    expect(trailingDialogue?.speaker).toBeUndefined()
  })

  it('serializes RPC rows with snake_case keys expected by Postgres', () => {
    const rows = buildScriptSearchChunks([
      block({ type: 'scene_heading', text: 'INT. OFFICE - DAY' }),
      block({ type: 'character', text: 'LUCILLE' }),
      block({ type: 'dialogue', text: 'Good for her.' }),
    ])

    const serialized = serializeSearchChunksForRpc(rows) as Array<Record<string, unknown>>
    expect(serialized[0]).toHaveProperty('block_id')
    expect(serialized[0]).toHaveProperty('block_text')
    expect(serialized[0]).toHaveProperty('act_label')
    expect(serialized[0]).toHaveProperty('scene_label')
    expect(serialized[0]).not.toHaveProperty('blockId')
    expect(serialized[0]).not.toHaveProperty('blockText')
  })
})

describe('rankSearchCandidates', () => {
  it('boosts matching dialogue for character-oriented queries', () => {
    const analysis = analyzeSearchQuery('when did Lucille say dramatic and flamboyant')
    const candidates: SearchCandidate[] = [
      {
        scriptId: 'script-a',
        scriptTitle: 'Pilot',
        blockId: 'dialogue-1',
        blockType: 'dialogue',
        blockText: 'Everything they do is so dramatic and flamboyant.',
        actLabel: 'Act One',
        sceneLabel: 'INT. YACHT CLUB - DAY',
        speaker: 'LUCILLE',
        position: 3000,
        retrievalScore: 0.61,
        exactMatch: true,
        tokenHits: 4,
      },
      {
        scriptId: 'script-a',
        scriptTitle: 'Pilot',
        blockId: 'action-1',
        blockType: 'action',
        blockText: "Michael's sister, Lindsay, has approached.",
        actLabel: 'Act One',
        sceneLabel: 'INT. YACHT CLUB - DAY',
        speaker: null,
        position: 4000,
        retrievalScore: 0.58,
        exactMatch: false,
        tokenHits: 2,
      },
    ]

    const ranked = rankSearchCandidates(candidates, analysis, 'script-a')
    expect(ranked[0]?.blockId).toBe('dialogue-1')
    expect(ranked[0]?.actLabel).toBe('Act One')
    expect(ranked[0]?.speaker).toBe('LUCILLE')
  })

  it('builds a compact snippet around the first relevant match', () => {
    const analysis = analyzeSearchQuery('"same sex marriage at sea"')
    const snippet = buildSearchSnippet(
      'Angle on: distant protest boat. A flag reads "Down with the Yacht Club." Another reads "Allow same sex marriage at sea!"',
      analysis,
      70
    )

    expect(snippet).toContain('same sex marriage at sea')
    expect(snippet.length).toBeLessThanOrEqual(72)
  })
})
