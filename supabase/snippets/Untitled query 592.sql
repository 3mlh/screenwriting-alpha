select
  count(*) filter (where semantic_text is not null) as chunks_with_semantic_text,
  count(*) filter (where semantic_embedding is not null) as chunks_with_embeddings
from public.script_search_chunks;