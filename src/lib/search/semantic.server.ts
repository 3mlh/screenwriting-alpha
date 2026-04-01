import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import {
  SEARCH_EMBEDDING_DIMENSIONS,
  SEARCH_EMBED_FUNCTION,
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

  const { data, error } = await supabase.functions.invoke<SearchEmbeddingResponse>(
    SEARCH_EMBED_FUNCTION,
    {
      body: { inputs: normalizedInputs },
    }
  )

  if (error) throw error

  const embeddings = data?.embeddings ?? []
  if (embeddings.length !== normalizedInputs.length) {
    throw new Error('Search embedding count did not match input count')
  }

  for (const embedding of embeddings) {
    if (embedding.length !== SEARCH_EMBEDDING_DIMENSIONS) {
      throw new Error('Search embedding dimensions did not match expected model output')
    }
  }

  return embeddings
}
