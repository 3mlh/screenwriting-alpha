-- ── 020: Private script search semantic embedding RPC ───────────────────────
--
-- Threads semantic embedding data through the existing search chunk replacement
-- RPC so the indexing path can persist generated vectors and their timestamps.

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
    semantic_text,
    semantic_embedding,
    semantic_indexed_at,
    act_label,
    act_normalized,
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
    x.semantic_text,
    CASE
      WHEN x.semantic_embedding IS NULL THEN NULL
      ELSE x.semantic_embedding::extensions.vector(384)
    END,
    x.semantic_indexed_at,
    x.act_label,
    x.act_normalized,
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
    semantic_text TEXT,
    semantic_embedding FLOAT8[],
    semantic_indexed_at TIMESTAMPTZ,
    act_label TEXT,
    act_normalized TEXT,
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
