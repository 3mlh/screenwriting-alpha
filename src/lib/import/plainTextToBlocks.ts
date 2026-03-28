import { v4 as uuidv4 } from 'uuid'
import type { Block, CharacterMetadata, SceneHeadingMetadata, SectionMetadata } from '@/types/screenplay'
import { ScriptImportParseError } from './types'

const SCENE_HEADING_RE = /^(?:(\d+[A-Z]?)\s+)?((?:INT\/EXT|EXT\/INT|INT|EXT)\..+?)(?:\s+(\d+[A-Z]?))?$/i
const SCENE_HEADING_START_RE = /^(?:(\d+[A-Z]?)\s+)?(?:INT\/EXT|EXT\/INT|INT|EXT)\./i
const SCENE_HEADING_TIME_RE = /^(?:(\d+[A-Z]?)\s+)?(?:DAY|NIGHT|LATER|CONTINUOUS|SAME|MOMENTS LATER|MORNING|AFTERNOON|EVENING|SUNRISE|SUNSET|DAWN|DUSK|LATER THAT NIGHT|THE NEXT DAY)(?:\s+(\d+[A-Z]?))?$/i
const ACT_START_RE = /^ACT\s+([A-Z0-9]+)$/i
const ACT_END_RE = /^END OF ACT\s+([A-Z0-9]+)$/i
const COLD_OPEN_RE = /^(?:COLD OPEN|END OF COLD OPEN)$/i
const TAG_RE = /^TAG$/i
const ACTION_CUE_RE = /^FREEZE FRAME\b/i
const TRANSITION_RE = /^(?:FADE IN|FADE OUT|CUT TO|SMASH CUT TO|DISSOLVE TO|MATCH CUT TO|WIPE TO|BACK TO|INTERCUT WITH|INTERCUT)\b[:.]?$/i
const SHOT_RE = /^(?:ANGLE ON|CLOSE ON|CLOSER ON|WIDE ON|POV|P\.O\.V\.|INSERT|SERIES OF SHOTS|MONTAGE|ESTABLISHING SHOT|HEADSHOT|PHOTO|ON THE SCREEN|ON THE MONITOR|ANGLE -|CLOSE -)\b/i
const IGNORED_LINE_RE = /^(?:\[\[\[\s*PAGE \d+\s*\]\]\]|\(CONTINUED\)|CONTINUED:?|MORE)$/

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeCharacterKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeCharacterDisplayName(value: string): string {
  return value
    .trim()
    .replace(/[~‐‑‒–—−]+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
}

function normalizeCharacterExtension(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/[\s._-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^V\.?O\.?$/, 'V.O.')
    .replace(/^O\.?S\.?$/, 'O.S.')
    .replace(/^O\.?C\.?$/, 'O.C.')
    .replace(/^CONT'?D\.?$/, "CONT'D")
}

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

function stripSceneNumbers(line: string): string {
  return line
    .replace(/^\d+[A-Z]?\s+/, '')
    .replace(/\s+\d+[A-Z]?$/, '')
    .trim()
}

function hasEdgeSceneNumber(line: string): boolean {
  return /^\d+[A-Z]?\s+/.test(line) || /\s+\d+[A-Z]?$/.test(line)
}

function isIgnorableLine(line: string): boolean {
  return IGNORED_LINE_RE.test(line)
}

function endsWithTerminalPunctuation(text: string): boolean {
  return /[.!?]["')\]]*$/.test(text.trim())
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

function collectSceneHeading(
  lines: string[],
  startIndex: number
): { parsed: { text: string; metadata: SceneHeadingMetadata }; nextIndex: number } | null {
  const firstLine = normalizeLine(lines[startIndex])
  if (!SCENE_HEADING_START_RE.test(firstLine)) return null

  let combined = firstLine
  let parsed = parseSceneHeading(combined)
  let index = startIndex + 1

  while (index < lines.length) {
    const nextLine = normalizeLine(lines[index])
    if (!nextLine || isIgnorableLine(nextLine)) break
    if (/[a-z]/.test(nextLine)) break

    const strippedNextLine = stripSceneNumbers(nextLine)
    const canExtend =
      SCENE_HEADING_TIME_RE.test(nextLine) ||
      (
        /[—-]$/.test(combined) &&
        (hasEdgeSceneNumber(combined) || hasEdgeSceneNumber(nextLine)) &&
        /^[A-Z0-9 .'\-/&]+$/.test(strippedNextLine)
      )

    if (!canExtend) break

    const merged = `${combined} ${strippedNextLine}`.replace(/\s+/g, ' ')
    const mergedParsed = parseSceneHeading(merged)
    if (!mergedParsed) break

    combined = merged
    parsed = mergedParsed
    index += 1
  }

  return parsed ? { parsed, nextIndex: index } : null
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

function isExplicitActionLine(line: string): boolean {
  return ACTION_CUE_RE.test(line)
}

function isShotLine(line: string): boolean {
  return SHOT_RE.test(stripSceneNumbers(line))
}

function isLikelyCharacterLine(line: string): boolean {
  if (line.length === 0 || line.length > 40) return false
  if (parseSceneHeading(line)) return false
  if (parseSection(line)) return false
  if (COLD_OPEN_RE.test(line)) return false
  if (isExplicitActionLine(line)) return false
  if (isTransitionLine(line) || isShotLine(line)) return false
  if (/[a-z]/.test(line)) return false
  if (!/[A-Z]/.test(line)) return false
  if (!/^[A-Z0-9 .'\-()\/&]+$/.test(line)) return false
  return true
}

function parseCharacter(line: string): { text: string; metadata?: CharacterMetadata } {
  const match = line.match(/^(.*?)\s+\(([^)]+)\)$/)
  if (!match) {
    return { text: normalizeCharacterDisplayName(line) }
  }

  return {
    text: normalizeCharacterDisplayName(match[1]),
    metadata: { extension: normalizeCharacterExtension(match[2]) },
  }
}

function splitKnownCharacterDialogue(
  line: string,
  knownCharacterNames: Map<string, string>
): { characterText: string; dialogueText: string } | null {
  const normalizedLine = normalizeCharacterKey(line)
  if (!normalizedLine) return null

  const candidates = Array.from(knownCharacterNames.entries()).sort(
    (a, b) => b[0].length - a[0].length
  )

  for (const [characterKey, characterText] of candidates) {
    if (!normalizedLine.startsWith(`${characterKey} `)) continue

    const tokenPattern = characterKey
      .split(' ')
      .map((token) => escapeRegex(token))
      .join('[^A-Za-z0-9]+')

    const match = line.match(new RegExp(`^(${tokenPattern})(?:\\s+|[^A-Za-z0-9]+)+(.*)$`, 'i'))
    if (!match) continue

    // Only split when the matched speaker prefix actually looks like a cue.
    // Sentence-case action like "Michael's sister..." should stay action.
    if (/[a-z]/.test(match[1])) continue

    const dialogueText = match[2].trim()
    if (!dialogueText) continue

    return {
      characterText,
      dialogueText,
    }
  }

  return null
}

function isStructuralLine(line: string): boolean {
  return Boolean(
    parseSceneHeading(line) ||
    parseSection(line) ||
    COLD_OPEN_RE.test(line) ||
    isExplicitActionLine(line) ||
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

function collectWrappedContinuation(
  lines: string[],
  startIndex: number,
  initialText: string
): { text: string; nextIndex: number } {
  let text = initialText.trim()
  let index = startIndex

  while (index < lines.length && text && !endsWithTerminalPunctuation(text)) {
    const line = normalizeLine(lines[index])
    if (!line || isIgnorableLine(line) || isStructuralLine(line) || isParentheticalLine(line)) break
    text = `${text} ${line}`.replace(/\s+/g, ' ')
    index += 1
  }

  return { text, nextIndex: index }
}

function shouldCollectShotContinuation(initialText: string): boolean {
  const text = initialText.trim()
  if (!text) return false

  // Bare visual cues like "HEADSHOT" should remain standalone shot lines.
  // More descriptive cues like "ANGLE ON:" or mixed-case descriptive text can
  // absorb OCR-wrapped continuation lines.
  return /:$/.test(text) || /[a-z]/.test(text)
}

export function plainTextToBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const knownCharacterNames = new Map<string, string>()
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

    const sceneHeading = collectSceneHeading(lines, index)
    if (sceneHeading) {
      emitBlock(blocks, 'scene_heading', sceneHeading.parsed.text, sceneHeading.parsed.metadata)
      index = sceneHeading.nextIndex
      continue
    }

    if (isTransitionLine(line)) {
      emitBlock(blocks, 'transition', line.toUpperCase())
      index += 1
      continue
    }

    if (isExplicitActionLine(line)) {
      emitBlock(blocks, 'action', line)
      index += 1
      continue
    }

    if (isShotLine(line)) {
      const shotText = stripSceneNumbers(line)
      const shot = shouldCollectShotContinuation(shotText)
        ? collectWrappedContinuation(lines, index + 1, shotText)
        : { text: shotText, nextIndex: index + 1 }
      emitBlock(blocks, 'shot', shot.text)
      index = shot.nextIndex
      continue
    }

    if (isLikelyCharacterLine(line)) {
      const character = parseCharacter(line)
      emitBlock(blocks, 'character', character.text, character.metadata)
      knownCharacterNames.set(normalizeCharacterKey(character.text), character.text)
      index += 1
      let hasSpeechContent = false

      while (index < lines.length) {
        const next = normalizeLine(lines[index])

        if (!next) {
          if (hasSpeechContent) break
          index += 1
          continue
        }

        if (isIgnorableLine(next)) {
          index += 1
          continue
        }

        if (isStructuralLine(next)) break

        if (isParentheticalLine(next)) {
          emitBlock(blocks, 'parenthetical', next)
          hasSpeechContent = true
          index += 1
          continue
        }

        const dialogue = collectParagraph(lines, index)
        if (!dialogue.text) break
        emitBlock(blocks, 'dialogue', dialogue.text)
        hasSpeechContent = true
        index = dialogue.nextIndex
      }

      continue
    }

    const splitDialogue = splitKnownCharacterDialogue(line, knownCharacterNames)
    if (splitDialogue) {
      emitBlock(blocks, 'character', splitDialogue.characterText)
      knownCharacterNames.set(
        normalizeCharacterKey(splitDialogue.characterText),
        splitDialogue.characterText
      )
      const dialogue = collectWrappedContinuation(lines, index + 1, splitDialogue.dialogueText)
      emitBlock(blocks, 'dialogue', dialogue.text)
      index = dialogue.nextIndex
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
