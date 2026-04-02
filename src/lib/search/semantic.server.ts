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

async function describeFunctionInvokeError(error: unknown): Promise<Error> {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error : new Error(String(error))
  }

  const response = 'context' in error ? (error as { context?: Response }).context : undefined
  if (!response) {
    return error instanceof Error ? error : new Error(String(error))
  }

  let bodyText = ''
  try {
    bodyText = await response.clone().text()
  } catch {
    bodyText = ''
  }

  const statusLine = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
  const message = bodyText
    ? `Search embed function failed (${statusLine}): ${bodyText}`
    : `Search embed function failed (${statusLine})`

  return new Error(message)
}

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

    if (error) throw await describeFunctionInvokeError(error)

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
