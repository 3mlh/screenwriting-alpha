import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { ScriptSearchResult, SearchCandidate, SearchQueryAnalysis, SearchRetrievalInput } from './types'
import { normalizeForSearch } from './index'

type AppSupabaseClient = SupabaseClient<Database>

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'did',
  'does',
  'find',
  'for',
  'in',
  'line',
  'me',
  'of',
  'say',
  'said',
  'scene',
  'show',
  'tell',
  'that',
  'the',
  'this',
  'what',
  'when',
  'where',
  'who',
])

function extractQuotedPhrases(rawQuery: string): string[] {
  return Array.from(rawQuery.matchAll(/"([^"]+)"/g))
    .map((match) => match[1]?.trim())
    .filter((phrase): phrase is string => Boolean(phrase))
}

function extractCharacterHint(rawQuery: string): string | undefined {
  const patterns = [
    /when\s+did\s+(.+?)\s+(?:say|said)\b/i,
    /what\s+did\s+(.+?)\s+(?:say|said)\b/i,
    /where\s+did\s+(.+?)\s+(?:say|said)\b/i,
    /find\s+(.+?)\s+(?:dialogue|line|quote)\b/i,
  ]

  for (const pattern of patterns) {
    const match = rawQuery.match(pattern)
    const hint = match?.[1]?.replace(/^character\s+/i, '').trim()
    if (hint) return hint
  }

  return undefined
}

function buildSemanticSearchQuery(rawQuery: string): string {
  return rawQuery
    .trim()
    .replace(/^(where|what|when|who)\s+(does|did|is)\s+/i, '')
    .replace(/^what\s+scene\s+/i, '')
    .replace(/^(find|show|tell)\s+me\s+/i, '')
    .replace(/^the\s+scene\s+where\s+/i, '')
    .replace(/\?+$/g, '')
    .trim()
}

function hasDistinctSemanticQuery(query: SearchQueryAnalysis): boolean {
  return normalizeForSearch(query.semanticQuery) !== query.normalizedQuery
}

export function analyzeSearchQuery(rawQuery: string): SearchQueryAnalysis {
  const trimmed = rawQuery.trim()
  const normalizedQuery = normalizeForSearch(trimmed)
  const quotedPhrases = extractQuotedPhrases(trimmed)
  const characterHint = extractCharacterHint(trimmed)
  const normalizedCharacterHint = characterHint
    ? normalizeForSearch(characterHint)
    : undefined

  const terms = normalizedQuery
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term))

  return {
    rawQuery: trimmed,
    normalizedQuery,
    semanticQuery: buildSemanticSearchQuery(trimmed),
    quotedPhrases,
    terms,
    characterHint,
    normalizedCharacterHint,
  }
}

function findSnippetStart(text: string, query: SearchQueryAnalysis): number {
  const lowerText = text.toLowerCase()

  for (const phrase of query.quotedPhrases) {
    const idx = lowerText.indexOf(phrase.toLowerCase())
    if (idx >= 0) return idx
  }

  if (query.rawQuery) {
    const idx = lowerText.indexOf(query.rawQuery.toLowerCase())
    if (idx >= 0) return idx
  }

  for (const term of query.terms) {
    const idx = lowerText.indexOf(term.toLowerCase())
    if (idx >= 0) return idx
  }

  return 0
}

export function buildSearchSnippet(text: string, query: SearchQueryAnalysis, maxLength = 180): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed

  const start = findSnippetStart(trimmed, query)
  const radius = Math.floor(maxLength / 2)
  const sliceStart = Math.max(0, start - radius)
  const sliceEnd = Math.min(trimmed.length, sliceStart + maxLength)

  const prefix = sliceStart > 0 ? '…' : ''
  const suffix = sliceEnd < trimmed.length ? '…' : ''
  return `${prefix}${trimmed.slice(sliceStart, sliceEnd).trim()}${suffix}`
}

export function scoreSearchCandidate(
  candidate: SearchCandidate,
  query: SearchQueryAnalysis,
  currentScriptId?: string
): number {
  const normalizedBlock = normalizeForSearch(candidate.blockText)
  const normalizedAct = candidate.actLabel ? normalizeForSearch(candidate.actLabel) : ''
  const normalizedSpeaker = candidate.speaker ? normalizeForSearch(candidate.speaker) : ''
  const normalizedScene = candidate.sceneLabel ? normalizeForSearch(candidate.sceneLabel) : ''

  let score = candidate.retrievalScore * 100
  score += candidate.tokenHits * 14
  if (candidate.exactMatch) score += 90
  if (candidate.scriptId === currentScriptId) score += 12

  for (const phrase of query.quotedPhrases) {
    const normalizedPhrase = normalizeForSearch(phrase)
    if (normalizedPhrase && normalizedBlock.includes(normalizedPhrase)) score += 140
  }

  if (query.normalizedQuery && normalizedBlock.includes(query.normalizedQuery)) {
    score += 60
  }
  if (query.normalizedQuery && normalizedAct.includes(query.normalizedQuery)) {
    score += 28
  }
  if (query.normalizedQuery && normalizedScene.includes(query.normalizedQuery)) {
    score += 36
  }

  for (const term of query.terms) {
    if (normalizedBlock.includes(term)) score += 10
    if (normalizedAct.includes(term)) score += 7
    if (normalizedSpeaker.includes(term)) score += 8
    if (normalizedScene.includes(term)) score += 6
  }

  if (query.normalizedCharacterHint && normalizedSpeaker) {
    if (normalizedSpeaker.includes(query.normalizedCharacterHint)) {
      score += 150
      if (candidate.blockType === 'dialogue') score += 50
      if (candidate.blockType === 'parenthetical') score += 15
    } else if (candidate.blockType === 'character') {
      score -= 20
    }
  }

  if (candidate.blockType === 'dialogue') score += 6
  if (candidate.blockType === 'parenthetical') score -= 8

  return score
}

function scoreCandidateBySource(candidate: SearchCandidate): number {
  if (candidate.retrievalSource === 'semantic') return 0
  return 0
}

export function rankSearchCandidates(
  candidates: SearchCandidate[],
  query: SearchQueryAnalysis,
  currentScriptId?: string
): ScriptSearchResult[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score:
        scoreSearchCandidate(candidate, query, currentScriptId) +
        scoreCandidateBySource(candidate),
    }))
    .sort((a, b) => b.score - a.score || a.candidate.position - b.candidate.position)
    .map(({ candidate }) => ({
      scriptId: candidate.scriptId,
      scriptTitle: candidate.scriptTitle,
      blockId: candidate.blockId,
      blockType: candidate.blockType,
      snippet: buildSearchSnippet(candidate.blockText, query),
      actLabel: candidate.actLabel ?? undefined,
      sceneLabel: candidate.sceneLabel ?? undefined,
      speaker: candidate.speaker ?? undefined,
    }))
}

async function fetchLexicalSearchCandidates(
  supabase: AppSupabaseClient,
  input: SearchRetrievalInput
): Promise<SearchCandidate[]> {
  const candidateLimit = Math.max(input.limit * 5, 25)
  const { data, error } = await supabase.rpc('search_project_script_candidates', {
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_query: input.analysis.normalizedQuery,
    p_limit: candidateLimit,
  })

  if (error) throw error

  return ((data ?? []) as Database['public']['Functions']['search_project_script_candidates']['Returns']).map(
    (row): SearchCandidate => ({
      scriptId: row.script_id,
      scriptTitle: row.script_title,
      blockId: row.block_id,
      blockType: row.block_type,
      blockText: row.block_text,
      actLabel: row.act_label,
      sceneLabel: row.scene_label,
      speaker: row.speaker,
      position: row.block_position,
      retrievalScore: row.retrieval_score,
      exactMatch: row.exact_match,
      tokenHits: row.token_hits,
      retrievalSource: 'lexical',
    })
  )
}

async function fetchSemanticSearchCandidates(
  _supabase: AppSupabaseClient,
  input: SearchRetrievalInput
): Promise<SearchCandidate[]> {
  if (!input.analysis.semanticQuery) return []
  if (!hasDistinctSemanticQuery(input.analysis)) return []
  return []
}

export async function searchProjectScripts(
  supabase: AppSupabaseClient,
  input: {
    projectId: string
    userId: string
    query: string
    currentScriptId?: string
    limit?: number
  }
): Promise<ScriptSearchResult[]> {
  const analysis = analyzeSearchQuery(input.query)
  if (!analysis.normalizedQuery) return []

  const limit = input.limit ?? 8
  const retrievalInput = {
    projectId: input.projectId,
    userId: input.userId,
    limit,
    analysis,
  }

  const semanticCandidates = await fetchSemanticSearchCandidates(supabase, retrievalInput)
  const candidates = semanticCandidates.length > 0
    ? semanticCandidates
    : await fetchLexicalSearchCandidates(supabase, retrievalInput)

  return rankSearchCandidates(candidates, analysis, input.currentScriptId).slice(0, limit)
}
