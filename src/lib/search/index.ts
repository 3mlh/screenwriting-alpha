import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { Block } from '@/types/screenplay'
import type { SearchIndexChunkInput } from './types'

type AppSupabaseClient = SupabaseClient<Database>

const SEARCHABLE_BLOCK_TYPES = new Set([
  'scene_heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
  'summary',
])

export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, ' ')
    .replace(/"/g, ' ')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9'\s./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function cleanSpeakerName(text: string): string {
  return text
    .replace(/\s*\((?:[^)(]+)\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchText(parts: Array<string | undefined>): string {
  return normalizeForSearch(parts.filter(Boolean).join(' '))
}

function buildChunkSearchFields(input: {
  blockType: Block['type']
  blockText: string
  actLabel?: string
  sceneLabel?: string
  speaker?: string
}) {
  const semanticParts = [
    input.actLabel ? `Act: ${input.actLabel}` : undefined,
    input.sceneLabel ? `Scene: ${input.sceneLabel}` : undefined,
    input.blockType === 'dialogue' || input.blockType === 'parenthetical'
      ? input.speaker
        ? `Speaker: ${input.speaker}`
        : undefined
      : `Type: ${input.blockType}`,
    input.blockType === 'dialogue' || input.blockType === 'parenthetical'
      ? `Dialogue: ${input.blockText}`
      : `Text: ${input.blockText}`,
  ].filter(Boolean)

  return {
    normalizedText: normalizeForSearch(input.blockText),
    searchText: buildSearchText([
      input.blockText,
      input.actLabel,
      input.sceneLabel,
      input.speaker,
    ]),
    semanticText: semanticParts.join('. '),
  }
}

function buildChunkEmbeddingPayload(input: {
  blockType: Block['type']
  semanticText: string
  actLabel?: string
  sceneLabel?: string
  speaker?: string
}) {
  return {
    semantic_text: input.semanticText,
    block_type: input.blockType,
    act_label: input.actLabel ?? null,
    scene_label: input.sceneLabel ?? null,
    speaker: input.speaker ?? null,
  }
}

function getSectionType(block: Block): string | undefined {
  if (block.type !== 'section' || !block.metadata || typeof block.metadata !== 'object') {
    return undefined
  }

  const sectionType = (block.metadata as Record<string, unknown>).section_type
  return typeof sectionType === 'string' ? sectionType : undefined
}

function getActLabel(block: Block): string | undefined {
  const sectionType = getSectionType(block)
  if (sectionType !== 'act_start') return undefined

  if (block.metadata && typeof block.metadata === 'object') {
    const label = (block.metadata as Record<string, unknown>).label
    if (typeof label === 'string' && label.trim()) return label.trim()
  }

  const trimmed = block.text.trim()
  return trimmed || undefined
}

function neighborText(blocks: Block[], index: number, direction: -1 | 1): string | undefined {
  let cursor = index + direction
  while (cursor >= 0 && cursor < blocks.length) {
    const text = blocks[cursor]?.text?.trim()
    if (text) return text
    cursor += direction
  }
  return undefined
}

export function buildScriptSearchChunks(blocks: Block[]): SearchIndexChunkInput[] {
  const ordered = [...blocks].sort((a, b) => a.position - b.position)
  const rows: SearchIndexChunkInput[] = []

  let currentActLabel: string | undefined
  let currentActNormalized: string | undefined
  let currentSceneLabel: string | undefined
  let currentSceneNormalized: string | undefined
  let currentSpeaker: string | undefined

  for (let i = 0; i < ordered.length; i += 1) {
    const block = ordered[i]
    const trimmed = block.text.trim()
    const sectionType = getSectionType(block)

    if (sectionType === 'act_start') {
      currentActLabel = getActLabel(block)
      currentActNormalized = currentActLabel ? normalizeForSearch(currentActLabel) : undefined
      currentSpeaker = undefined
    } else if (sectionType === 'act_end') {
      currentActLabel = undefined
      currentActNormalized = undefined
      currentSpeaker = undefined
    } else if (block.type === 'scene_heading') {
      currentSceneLabel = trimmed
      currentSceneNormalized = normalizeForSearch(trimmed)
      currentSpeaker = undefined
    } else if (block.type === 'character') {
      currentSpeaker = cleanSpeakerName(trimmed)
    } else if (
      block.type === 'action' ||
      block.type === 'shot' ||
      block.type === 'transition' ||
      block.type === 'summary' ||
      block.type === 'section' ||
      block.type === 'cold_open_marker'
    ) {
      currentSpeaker = undefined
    }

    if (!trimmed) continue

    if (!SEARCHABLE_BLOCK_TYPES.has(block.type)) continue

    const speaker = block.type === 'dialogue' || block.type === 'parenthetical'
      ? currentSpeaker
      : block.type === 'character'
        ? currentSpeaker
        : undefined
    const speakerNormalized = speaker ? normalizeForSearch(speaker) : undefined
    const searchFields = buildChunkSearchFields({
      blockType: block.type,
      blockText: trimmed,
      actLabel: currentActLabel,
      sceneLabel: currentSceneLabel,
      speaker,
    })
    const embeddingPayload = buildChunkEmbeddingPayload({
      blockType: block.type,
      semanticText: searchFields.semanticText,
      actLabel: currentActLabel,
      sceneLabel: currentSceneLabel,
      speaker,
    })

    rows.push({
      blockId: block.id,
      blockType: block.type,
      position: block.position,
      blockText: trimmed,
      normalizedText: searchFields.normalizedText,
      searchText: searchFields.searchText,
      semanticText: searchFields.semanticText,
      actLabel: currentActLabel,
      actNormalized: currentActNormalized,
      sceneLabel: currentSceneLabel,
      sceneNormalized: currentSceneNormalized,
      speaker,
      speakerNormalized,
      contextBefore: neighborText(ordered, i, -1),
      contextAfter: neighborText(ordered, i, 1),
      metadata:
        block.metadata && typeof block.metadata === 'object'
          ? (block.metadata as Record<string, unknown>)
          : {},
      embeddingVersion: 'semantic-v1',
      embeddingPayload,
    })
  }

  return rows
}

export function serializeSearchChunksForRpc(rows: SearchIndexChunkInput[]): Json {
  return rows.map((row) => ({
    block_id: row.blockId,
    block_type: row.blockType,
    position: row.position,
    block_text: row.blockText,
    normalized_text: row.normalizedText,
    search_text: row.searchText,
    semantic_text: row.semanticText ?? null,
    act_label: row.actLabel ?? null,
    act_normalized: row.actNormalized ?? null,
    scene_label: row.sceneLabel ?? null,
    scene_normalized: row.sceneNormalized ?? null,
    speaker: row.speaker ?? null,
    speaker_normalized: row.speakerNormalized ?? null,
    context_before: row.contextBefore ?? null,
    context_after: row.contextAfter ?? null,
    metadata: row.metadata ?? {},
    embedding_version: row.embeddingVersion ?? null,
    embedding_payload: row.embeddingPayload ?? null,
  })) as Json
}

export async function replaceScriptSearchChunks(
  supabase: AppSupabaseClient,
  userId: string,
  scriptId: string,
  blocks: Block[]
): Promise<void> {
  const rows = buildScriptSearchChunks(blocks)
  const { error } = await supabase.rpc('replace_script_search_chunks', {
    p_script_id: scriptId,
    p_user_id: userId,
    p_rows: serializeSearchChunksForRpc(rows),
  })

  if (error) throw error
}
