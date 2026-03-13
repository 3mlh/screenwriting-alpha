-- ── M4 addendum: Initial Draft ────────────────────────────────────────────────
--
-- 1. Allow empty string color in revision_sets ('' = no margin marks)
-- 2. Backfill existing scripts: create "Initial Draft" revision set for any
--    script that doesn't already have current_revision_set_id set.
--
-- New scripts get Initial Draft created at the application layer (scripts route).

-- Allow empty color (no explicit CHECK constraint was added, so no change needed
-- to the column itself — just document that '' is the "no color" sentinel value).

-- ── Backfill existing scripts ─────────────────────────────────────────────────
--
-- For each script with no current_revision_set_id:
--   1. Insert a revision_open snapshot (using current blocks as baseline)
--   2. Insert an "Initial Draft" revision set pointing at that snapshot
--   3. Set scripts.current_revision_set_id

DO $$
DECLARE
  r RECORD;
  v_snapshot_id UUID;
  v_revision_set_id UUID;
BEGIN
  FOR r IN
    SELECT id, blocks, created_by
    FROM public.scripts
    WHERE current_revision_set_id IS NULL
  LOOP
    -- Create baseline snapshot
    INSERT INTO public.script_snapshots (script_id, blocks, taken_by, trigger_type, label)
    VALUES (r.id, r.blocks, r.created_by, 'revision_open', 'Initial Draft — opened')
    RETURNING id INTO v_snapshot_id;

    -- Create Initial Draft revision set (empty color = no marks)
    INSERT INTO public.revision_sets
      (script_id, name, color, open_snapshot_id, created_by, is_active)
    VALUES (r.id, 'Initial Draft', '', v_snapshot_id, r.created_by, TRUE)
    RETURNING id INTO v_revision_set_id;

    -- Link script to revision set
    UPDATE public.scripts
    SET current_revision_set_id = v_revision_set_id
    WHERE id = r.id;
  END LOOP;
END;
$$;
