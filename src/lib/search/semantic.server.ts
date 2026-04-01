import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import {
  SEARCH_EMBEDDING_DIMENSIONS,
  SEARCH_EMBED_FUNCTION,
  SEARCH_EMBEDDING_MAX_INPUTS,
  type SearchEmbeddingResponse,
  normalizeSearchEmbeddingInputs,
} from './semantic'

type AppSupabaseClient = SupabaseClient<Database>

export async function generateSearchEmbeddings(
  supabase: AppSupabaseClient,
  inputs: string[]
): Promise<number[][]> {
  const normalizedInputs = normalizeSearchEmbeddingInputs(inputs)
  if (normalizedInputs.length === 0) return []

  const embeddings: number[][] = []

  for (let i = 0; i < normalizedInputs.length; i += SEARCH_EMBEDDING_MAX_INPUTS) {
    const batch = normalizedInputs.slice(i, i + SEARCH_EMBEDDING_MAX_INPUTS)
    const { data, error } = await supabase.functions.invoke<SearchEmbeddingResponse>(
      SEARCH_EMBED_FUNCTION,
      {
        body: { inputs: batch },
      }
    )

    if (error) throw error

    const batchEmbeddings = data?.embeddings ?? []
    if (batchEmbeddings.length !== batch.length) {
      throw new Error('Search embedding count did not match input count')
    }

    for (const embedding of batchEmbeddings) {
      if (embedding.length !== SEARCH_EMBEDDING_DIMENSIONS) {
        throw new Error('Search embedding dimensions did not match expected model output')
      }

      embeddings.push(embedding)
    }
  }

  return embeddings
}
