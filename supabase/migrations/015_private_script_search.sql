-- ── 015: Private script search index + candidate retrieval ───────────────────

CREATE TABLE public.script_search_chunks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  script_id         UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  block_id          UUID NOT NULL,
  block_type        TEXT NOT NULL,
  position          BIGINT NOT NULL,
  block_text        TEXT NOT NULL,
  normalized_text   TEXT NOT NULL,
  search_text       TEXT NOT NULL,
  scene_label       TEXT,
  scene_normalized  TEXT,
  speaker           TEXT,
  speaker_normalized TEXT,
  context_before    TEXT,
  context_after     TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding_version TEXT,
  embedding_payload JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (script_id, block_id)
);

CREATE INDEX idx_script_search_chunks_project_id
  ON public.script_search_chunks(project_id);

CREATE INDEX idx_script_search_chunks_script_id
  ON public.script_search_chunks(script_id);

CREATE INDEX idx_script_search_chunks_search_text_trgm
  ON public.script_search_chunks
  USING GIN (search_text gin_trgm_ops);

CREATE INDEX idx_script_search_chunks_normalized_text_trgm
  ON public.script_search_chunks
  USING GIN (normalized_text gin_trgm_ops);

CREATE INDEX idx_script_search_chunks_speaker_trgm
  ON public.script_search_chunks
  USING GIN (speaker_normalized gin_trgm_ops);

CREATE TRIGGER script_search_chunks_updated_at
  BEFORE UPDATE ON public.script_search_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.script_search_chunks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.replace_script_search_chunks(
  p_script_id UUID,
  p_user_id UUID,
  p_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.permission_level;
  v_project_id UUID;
BEGIN
  v_role := public.effective_script_role(p_script_id, p_user_id);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'editor') THEN
    RAISE EXCEPTION 'Insufficient permissions'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.project_id
    INTO v_project_id
    FROM public.scripts s
   WHERE s.id = p_script_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Script not found'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.script_search_chunks
   WHERE script_id = p_script_id;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.script_search_chunks (
    project_id,
    script_id,
    block_id,
    block_type,
    position,
    block_text,
    normalized_text,
    search_text,
    scene_label,
    scene_normalized,
    speaker,
    speaker_normalized,
    context_before,
    context_after,
    metadata,
    embedding_version,
    embedding_payload
  )
  SELECT
    v_project_id,
    p_script_id,
    x.block_id,
    x.block_type,
    x.position,
    x.block_text,
    x.normalized_text,
    x.search_text,
    x.scene_label,
    x.scene_normalized,
    x.speaker,
    x.speaker_normalized,
    x.context_before,
    x.context_after,
    COALESCE(x.metadata, '{}'::jsonb),
    x.embedding_version,
    x.embedding_payload
  FROM jsonb_to_recordset(p_rows) AS x(
    block_id UUID,
    block_type TEXT,
    position BIGINT,
    block_text TEXT,
    normalized_text TEXT,
    search_text TEXT,
    scene_label TEXT,
    scene_normalized TEXT,
    speaker TEXT,
    speaker_normalized TEXT,
    context_before TEXT,
    context_after TEXT,
    metadata JSONB,
    embedding_version TEXT,
    embedding_payload JSONB
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.search_project_script_candidates(
  p_project_id UUID,
  p_user_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  script_id UUID,
  script_title TEXT,
  block_id UUID,
  block_type TEXT,
  block_text TEXT,
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
  ),
  q AS (
    SELECT lower(trim(regexp_replace(COALESCE(p_query, ''), '\s+', ' ', 'g'))) AS raw_query
  ),
  tokens AS (
    SELECT token
    FROM q, regexp_split_to_table(q.raw_query, '\s+') AS token
    WHERE char_length(token) >= 2
  ),
  candidates AS (
    SELECT
      c.script_id,
      s.title AS script_title,
      c.block_id,
      c.block_type,
      c.block_text,
      c.scene_label,
      c.speaker,
      c.position,
      GREATEST(
        public.similarity(c.search_text, q.raw_query),
        public.similarity(c.normalized_text, q.raw_query),
        public.similarity(COALESCE(c.speaker_normalized, ''), q.raw_query),
        public.similarity(COALESCE(c.scene_normalized, ''), q.raw_query)
      )::REAL AS retrieval_score,
      (c.normalized_text LIKE '%' || q.raw_query || '%'
        OR COALESCE(c.speaker_normalized, '') LIKE '%' || q.raw_query || '%') AS exact_match,
      (
        SELECT COUNT(*)
        FROM tokens t
        WHERE c.search_text LIKE '%' || t.token || '%'
      )::INTEGER AS token_hits
    FROM public.script_search_chunks c
    JOIN public.scripts s
      ON s.id = c.script_id
    CROSS JOIN q
    CROSS JOIN permission_check pc
    WHERE pc.role IS NOT NULL
      AND c.project_id = p_project_id
      AND public.effective_script_role(c.script_id, p_user_id) IS NOT NULL
      AND q.raw_query <> ''
      AND (
        c.search_text LIKE '%' || q.raw_query || '%'
        OR c.search_text OPERATOR(public.%) q.raw_query
        OR EXISTS (
          SELECT 1
          FROM tokens t
          WHERE c.search_text LIKE '%' || t.token || '%'
             OR c.search_text OPERATOR(public.%) t.token
        )
      )
  )
  SELECT
    script_id,
    script_title,
    block_id,
    block_type,
    block_text,
    scene_label,
    speaker,
    position AS block_position,
    retrieval_score,
    exact_match,
    token_hits
  FROM candidates
  ORDER BY exact_match DESC, token_hits DESC, retrieval_score DESC, position ASC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;
