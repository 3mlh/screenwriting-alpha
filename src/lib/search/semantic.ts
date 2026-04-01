export const SEARCH_EMBEDDING_MODEL = 'gte-small'
export const SEARCH_EMBEDDING_DIMENSIONS = 384
export const SEARCH_EMBED_FUNCTION = 'search-embed'
export const SEARCH_EMBEDDING_MAX_INPUTS = 32

export interface SearchEmbeddingRequest {
  inputs: string[]
}

export interface SearchEmbeddingResponse {
  model: string
  dimensions: number
  embeddings: number[][]
}

export function normalizeSearchEmbeddingInputs(inputs: string[]): string[] {
  return inputs
    .map((input) => input.trim())
    .filter((input) => input.length > 0)
}

export function isLocalSearchSemanticDisabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return url.includes('127.0.0.1') || url.includes('localhost')
}
