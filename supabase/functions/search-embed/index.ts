// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const MODEL = 'gte-small'
const DIMENSIONS = 384
const MAX_INPUTS = 8

interface SearchEmbeddingRequest {
  inputs: string[]
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function normalizeInputs(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  return input
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = (await request.json()) as Partial<SearchEmbeddingRequest>
    const inputs = normalizeInputs(body.inputs)

    if (inputs.length === 0) {
      return json({ error: 'At least one input is required' }, 400)
    }

    if (inputs.length > MAX_INPUTS) {
      return json({ error: `At most ${MAX_INPUTS} inputs are allowed per request` }, 400)
    }

    const session = new Supabase.ai.Session(MODEL)

    const embeddings: number[][] = []

    for (const input of inputs) {
      const embedding = await session.run(input, {
        mean_pool: true,
        normalize: true,
      })

      embeddings.push(embedding)
    }

    return json({
      model: MODEL,
      dimensions: DIMENSIONS,
      embeddings,
    })
  } catch (error) {
    console.error('search-embed failed:', error)
    return json({ error: 'Failed to generate embeddings' }, 500)
  }
})
