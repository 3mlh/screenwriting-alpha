import type { Block } from '@/types/screenplay'

// ─── Character stats ──────────────────────────────────────────────────────────

export interface CharacterStats {
  /** Normalized character name: trimmed and uppercased. */
  name: string
  /** Number of dialogue blocks attributed to this character. */
  dialogueCount: number
  /** Number of distinct scenes the character speaks in. */
  sceneCount: number
  /** Ordered list of scene heading block IDs where the character speaks. */
  sceneIds: string[]
  /** Total word count across all attributed dialogue blocks. */
  wordCount: number
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

/**
 * Derive per-character dialogue statistics from a Block[].
 *
 * Attribution logic:
 *  - A `character` block sets the current speaker.
 *  - A `parenthetical` block does not change the current speaker.
 *  - A `dialogue` block is attributed to the current speaker and increments
 *    their counts.
 *  - Any other block type (action, scene_heading, shot, transition, section,
 *    summary, cold_open_marker) resets the current speaker.
 *
 * A character only appears in the result if they have at least one dialogue block.
 * Results are sorted by dialogueCount descending.
 */
export function deriveCharacterStats(blocks: Block[]): CharacterStats[] {
  const statsMap = new Map<string, CharacterStats>()
  let currentCharacter: string | null = null
  let currentSceneId: string | null = null

  for (const block of blocks) {
    switch (block.type) {
      case 'scene_heading':
        currentSceneId = block.id
        currentCharacter = null
        break

      case 'character':
        currentCharacter = block.text.trim().toUpperCase()
        break

      case 'parenthetical':
        // Parentheticals sit between a character name and their dialogue lines.
        // Keep current speaker active.
        break

      case 'dialogue': {
        if (!currentCharacter) break
        if (!statsMap.has(currentCharacter)) {
          statsMap.set(currentCharacter, {
            name: currentCharacter,
            dialogueCount: 0,
            sceneCount: 0,
            sceneIds: [],
            wordCount: 0,
          })
        }
        const stats = statsMap.get(currentCharacter)!
        stats.dialogueCount++
        stats.wordCount += countWords(block.text)
        if (currentSceneId !== null && !stats.sceneIds.includes(currentSceneId)) {
          stats.sceneIds.push(currentSceneId)
          stats.sceneCount++
        }
        break
      }

      default:
        // action, shot, transition, section, summary, cold_open_marker
        currentCharacter = null
    }
  }

  return Array.from(statsMap.values()).sort((a, b) => b.dialogueCount - a.dialogueCount)
}
