import { v4 as uuidv4 } from 'uuid'
import type { Block, CharacterMetadata, SceneHeadingMetadata, SectionMetadata } from '@/types/screenplay'
import { ScriptImportParseError } from './types'

const SCENE_HEADING_RE = /^(?:(\d+[A-Z]?)\s+)?((?:INT\/EXT|EXT\/INT|INT|EXT)\..+?)(?:\s+(\d+[A-Z]?))?$/i
const ACT_START_RE = /^ACT\s+([A-Z0-9]+)$/i
const ACT_END_RE = /^END OF ACT\s+([A-Z0-9]+)$/i
const COLD_OPEN_RE = /^(?:COLD OPEN|END OF COLD OPEN)$/i
const TAG_RE = /^TAG$/i
const TRANSITION_RE = /^(?:FADE IN|FADE OUT|CUT TO|SMASH CUT TO|DISSOLVE TO|MATCH CUT TO|WIPE TO|BACK TO|INTERCUT WITH|INTERCUT)\b[:.]?$/i
const SHOT_RE = /^(?:ANGLE ON|CLOSE ON|CLOSER ON|WIDE ON|POV|P\.O\.V\.|INSERT|SERIES OF SHOTS|MONTAGE|ESTABLISHING SHOT|ON THE SCREEN|ON THE MONITOR|ANGLE -|CLOSE -)\b/i
const IGNORED_LINE_RE = /^(?:\[\[\[\s*PAGE \d+\s*\]\]\]|\(CONTINUED\)|CONTINUED:?|MORE)$/

function emitBlock(
  blocks: Block[],
  type: Block['type'],
  text: string,
  metadata?: Block['metadata']
): void {
  blocks.push({
    id: uuidv4(),
    type,
    text,
    position: (blocks.length + 1) * 1000,
    ...(metadata ? { metadata } : {}),
  })
}

function normalizeText(text: string): string {
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
}

function normalizeLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ')
}

function isIgnorableLine(line: string): boolean {
  return IGNORED_LINE_RE.test(line)
}

function isParentheticalLine(line: string): boolean {
  return /^\(.*\)$/.test(line)
}

function parseSceneHeading(line: string): { text: string; metadata: SceneHeadingMetadata } | null {
  const match = line.match(SCENE_HEADING_RE)
  if (!match) return null

  const [, leadingSceneNumber, headingText, trailingSceneNumber] = match
  const heading = headingText.trim().replace(/\s+/g, ' ')
  const sceneNumber = trailingSceneNumber ?? leadingSceneNumber
  const headingMatch = heading.match(/^((?:INT\/EXT|EXT\/INT|INT|EXT))\.\s*(.+)$/i)

  const metadata: SceneHeadingMetadata = {}
  if (sceneNumber) metadata.scene_number = sceneNumber

  if (headingMatch) {
    const intExt = headingMatch[1].toUpperCase() as SceneHeadingMetadata['int_ext']
    const remainder = headingMatch[2].trim()
    const parts = remainder.split(/\s+[—-]\s+/)

    metadata.int_ext = intExt
    if (parts.length > 1) {
      metadata.time_of_day = parts[parts.length - 1].trim()
      metadata.location = parts.slice(0, -1).join(' — ').trim()
    } else {
      metadata.location = remainder
    }
  }

  return { text: heading, metadata }
}

function parseSection(line: string): { text: string; metadata: SectionMetadata } | null {
  const actStart = line.match(ACT_START_RE)
  if (actStart) {
    const label = `Act ${actStart[1]}`
    return {
      text: line.toUpperCase(),
      metadata: { section_type: 'act_start', level: 1, label },
    }
  }

  const actEnd = line.match(ACT_END_RE)
  if (actEnd) {
    const label = `End of Act ${actEnd[1]}`
    return {
      text: line.toUpperCase(),
      metadata: { section_type: 'act_end', level: 1, label },
    }
  }

  if (TAG_RE.test(line)) {
    return {
      text: 'TAG',
      metadata: { section_type: 'sequence', level: 1, label: 'Tag' },
    }
  }

  return null
}

function isTransitionLine(line: string): boolean {
  return TRANSITION_RE.test(line)
}

function isShotLine(line: string): boolean {
  return SHOT_RE.test(line)
}

function isLikelyCharacterLine(line: string): boolean {
  if (line.length === 0 || line.length > 40) return false
  if (parseSceneHeading(line)) return false
  if (parseSection(line)) return false
  if (COLD_OPEN_RE.test(line)) return false
  if (isTransitionLine(line) || isShotLine(line)) return false
  if (/[a-z]/.test(line)) return false
  if (!/[A-Z]/.test(line)) return false
  if (!/^[A-Z0-9 .'\-()\/&]+$/.test(line)) return false
  return true
}

function parseCharacter(line: string): { text: string; metadata?: CharacterMetadata } {
  const match = line.match(/^(.*?)\s+\(([^)]+)\)$/)
  if (!match) {
    return { text: line }
  }

  return {
    text: match[1].trim(),
    metadata: { extension: match[2].trim() },
  }
}

function isStructuralLine(line: string): boolean {
  return Boolean(
    parseSceneHeading(line) ||
    parseSection(line) ||
    COLD_OPEN_RE.test(line) ||
    isTransitionLine(line) ||
    isShotLine(line) ||
    isLikelyCharacterLine(line)
  )
}

function collectParagraph(lines: string[], startIndex: number): { text: string; nextIndex: number } {
  const parts: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const line = normalizeLine(lines[index])
    if (!line || isIgnorableLine(line) || isStructuralLine(line) || isParentheticalLine(line)) break
    parts.push(line)
    index += 1
  }

  return { text: parts.join(' '), nextIndex: index }
}

export function plainTextToBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const lines = normalizeText(text).split('\n')
  let index = 0

  while (index < lines.length) {
    const line = normalizeLine(lines[index])

    if (!line || isIgnorableLine(line)) {
      index += 1
      continue
    }

    if (COLD_OPEN_RE.test(line)) {
      emitBlock(blocks, 'cold_open_marker', line.toUpperCase())
      index += 1
      continue
    }

    const section = parseSection(line)
    if (section) {
      emitBlock(blocks, 'section', section.text, section.metadata)
      index += 1
      continue
    }

    const sceneHeading = parseSceneHeading(line)
    if (sceneHeading) {
      emitBlock(blocks, 'scene_heading', sceneHeading.text, sceneHeading.metadata)
      index += 1
      continue
    }

    if (isTransitionLine(line)) {
      emitBlock(blocks, 'transition', line.toUpperCase())
      index += 1
      continue
    }

    if (isShotLine(line)) {
      emitBlock(blocks, 'shot', line)
      index += 1
      continue
    }

    if (isLikelyCharacterLine(line)) {
      const character = parseCharacter(line)
      emitBlock(blocks, 'character', character.text, character.metadata)
      index += 1

      while (index < lines.length) {
        const next = normalizeLine(lines[index])

        if (!next || isIgnorableLine(next)) {
          index += 1
          continue
        }

        if (isStructuralLine(next)) break

        if (isParentheticalLine(next)) {
          emitBlock(blocks, 'parenthetical', next)
          index += 1
          continue
        }

        const dialogue = collectParagraph(lines, index)
        if (!dialogue.text) break
        emitBlock(blocks, 'dialogue', dialogue.text)
        index = dialogue.nextIndex
      }

      continue
    }

    const action = collectParagraph(lines, index)
    if (action.text) {
      emitBlock(blocks, 'action', action.text)
      index = action.nextIndex
      continue
    }

    index += 1
  }

  return blocks
}

export function parsePlainTextScript(text: string): Block[] {
  const blocks = plainTextToBlocks(text)

  if (blocks.length === 0) {
    throw new ScriptImportParseError('No screenplay content could be parsed from this text file')
  }

  return blocks
}
