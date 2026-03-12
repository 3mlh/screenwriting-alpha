import type { Block, Scene, SceneHeadingMetadata } from '@/types/screenplay'

// ─── Scene heading parser ─────────────────────────────────────────────────────

const INT_EXT_PREFIX = /^(INT\/EXT|EXT\/INT|INT|EXT)\.\s*/i

/**
 * Parse INT/EXT, location, and time_of_day from a scene heading text string.
 *
 * Handles the common format: `INT/EXT. LOCATION — TIME`
 * Location may itself contain " — " (e.g. "LIGHTHOUSE — LOWER LEVEL"), so we
 * split on all separators and treat the last segment as the time of day.
 */
export function parseSceneHeading(text: string): Partial<SceneHeadingMetadata> {
  const upper = text.trim().toUpperCase()
  const result: Partial<SceneHeadingMetadata> = {}

  const intExtMatch = upper.match(INT_EXT_PREFIX)
  if (!intExtMatch) return result

  result.int_ext = intExtMatch[1] as SceneHeadingMetadata['int_ext']
  const rest = upper.slice(intExtMatch[0].length).trim()

  // Split on all " — " (em-dash) or " - " (hyphen-minus) separators.
  // Last segment is time of day; everything before is the location.
  const parts = rest.split(/ — | - /)
  if (parts.length >= 2) {
    result.location = parts.slice(0, -1).join(' — ')
    result.time_of_day = parts[parts.length - 1].trim()
  } else {
    result.location = rest
  }

  return result
}

// ─── Scene derivation ─────────────────────────────────────────────────────────

/**
 * Derive Scene[] from a Block[]. Scenes are delimited by scene_heading blocks.
 * Scene numbers are 1-based ordinals in document order.
 *
 * Blocks before the first scene_heading are ignored (they have no scene context).
 */
export function deriveScenes(blocks: Block[]): Scene[] {
  const scenes: Scene[] = []
  let current: Scene | null = null

  for (const block of blocks) {
    if (block.type === 'scene_heading') {
      if (current) scenes.push(current)
      current = {
        id: block.id,
        sceneNumber: scenes.length + 1, // 1-based; scenes.length = count already pushed
        heading: block,
        blocks: [],
        startPosition: block.position,
      }
    } else if (current) {
      current.blocks.push(block)
    }
  }

  if (current) scenes.push(current)
  return scenes
}
