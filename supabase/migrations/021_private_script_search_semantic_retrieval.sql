-- ── 021: Private script search semantic retrieval ────────────────────────────
--
-- Adds project-scoped semantic retrieval over stored screenplay embeddings.

CREATE INDEX IF NOT EXISTS idx_script_search_chunks_semantic_embedding
  ON public.script_search_chunks
  USING hnsw (semantic_embedding extensions.vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.search_project_script_candidates_semantic(
  p_project_id UUID,
  p_user_id UUID,
  p_query_embedding extensions.vector(384),
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  script_id UUID,
  script_title TEXT,
  block_id UUID,
  block_type TEXT,
  block_text TEXT,
  act_label TEXT,
  scene_label TEXT,
  speaker TEXT,
  block_position BIGINT,
  retrieval_score REAL,
  exact_match BOOLEAN,
  token_hits INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH permission_check AS (
    SELECT public.project_role(p_project_id, p_user_id) AS role
  )
  SELECT
    c.script_id,
    s.title AS script_title,
    c.block_id,
    c.block_type,
    c.block_text,
    c.act_label,
    c.scene_label,
    c.speaker,
    c.position AS block_position,
    (1 - (c.semantic_embedding OPERATOR(extensions.<=>) p_query_embedding))::REAL AS retrieval_score,
    FALSE AS exact_match,
    0 AS token_hits
  FROM public.script_search_chunks c
  JOIN public.scripts s
    ON s.id = c.script_id
  CROSS JOIN permission_check pc
  WHERE pc.role IS NOT NULL
    AND c.project_id = p_project_id
    AND c.semantic_embedding IS NOT NULL
    AND public.effective_script_role(c.script_id, p_user_id) IS NOT NULL
  ORDER BY c.semantic_embedding OPERATOR(extensions.<=>) p_query_embedding, c.position ASC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;
