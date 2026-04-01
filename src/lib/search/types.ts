import type { BlockType } from '@/types/screenplay'

export interface SearchIndexChunkInput {
  blockId: string
  blockType: BlockType
  position: number
  blockText: string
  normalizedText: string
  searchText: string
  semanticText?: string
  semanticEmbedding?: number[]
  semanticIndexedAt?: string
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
  semanticQuery: string
  quotedPhrases: string[]
  terms: string[]
  characterHint?: string
  normalizedCharacterHint?: string
}

export interface SearchRetrievalInput {
  projectId: string
  userId: string
  limit: number
  analysis: SearchQueryAnalysis
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
  retrievalSource?: 'lexical' | 'semantic'
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
