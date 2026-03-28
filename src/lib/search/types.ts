import type { BlockType } from '@/types/screenplay'

export interface SearchIndexChunkInput {
  blockId: string
  blockType: BlockType
  position: number
  blockText: string
  normalizedText: string
  searchText: string
  actLabel?: string
  actNormalized?: string
  sceneLabel?: string
  sceneNormalized?: string
  speaker?: string
  speakerNormalized?: string
  contextBefore?: string
  contextAfter?: string
  metadata?: Record<string, unknown>
  embeddingVersion?: string
  embeddingPayload?: Record<string, unknown>
}

export interface SearchQueryAnalysis {
  rawQuery: string
  normalizedQuery: string
  quotedPhrases: string[]
  terms: string[]
  characterHint?: string
  normalizedCharacterHint?: string
}

export interface SearchCandidate {
  scriptId: string
  scriptTitle: string
  blockId: string
  blockType: string
  blockText: string
  actLabel?: string | null
  sceneLabel?: string | null
  speaker?: string | null
  position: number
  retrievalScore: number
  exactMatch: boolean
  tokenHits: number
}

export interface ScriptSearchResult {
  scriptId: string
  scriptTitle: string
  blockId: string
  blockType: string
  snippet: string
  actLabel?: string
  sceneLabel?: string
  speaker?: string
}

export interface StoredScriptSearchState {
  id: string
  projectId: string
  originScriptId: string
  query: string
  results: ScriptSearchResult[]
  createdAt: string
}
