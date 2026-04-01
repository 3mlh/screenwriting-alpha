-- ── 018: Private script search semantic columns ──────────────────────────────
--
-- Adds first-class semantic search storage to the existing private search
-- index so we can persist screenplay-aware semantic text and vector embeddings
-- without changing the current search UX yet.

ALTER TABLE public.script_search_chunks
  ADD COLUMN IF NOT EXISTS semantic_text TEXT,
  ADD COLUMN IF NOT EXISTS semantic_embedding extensions.vector(384),
  ADD COLUMN IF NOT EXISTS semantic_indexed_at TIMESTAMPTZ;
