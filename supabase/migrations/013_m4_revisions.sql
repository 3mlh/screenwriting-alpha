-- ── M4: Revision / Versioning Foundation ──────────────────────────────────────
--
-- Adds:
--   1. revision_sets table — named revision drafts (Yellow Draft, Blue Draft…)
--   2. scripts.current_revision_set_id — FK to active revision set
--   3. RLS on revision_sets (script readers can read; editors/owners can write)
--
-- script_snapshots was already created in an earlier migration (referenced in
-- database.types.ts). This migration adds revision_sets and the FK column.

-- ── REVISION SETS ─────────────────────────────────────────────────────────────

CREATE TABLE revision_sets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id         UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,               -- "Yellow Draft", "Blue Draft"
  color             TEXT NOT NULL DEFAULT '#F59E0B',  -- hex colour for margin marks
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at         TIMESTAMPTZ,
  open_snapshot_id  UUID NOT NULL REFERENCES script_snapshots(id),
  close_snapshot_id UUID REFERENCES script_snapshots(id),
  created_by        UUID NOT NULL REFERENCES profiles(id),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE revision_sets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_revision_sets_script_id ON revision_sets(script_id);

CREATE TRIGGER revision_sets_updated_at
  BEFORE UPDATE ON revision_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Readers can see revision sets; editors/owners can create/update
CREATE POLICY "revision_sets: readable by script readers"
  ON revision_sets FOR SELECT
  USING (effective_script_role(script_id, auth.uid()) IS NOT NULL);

CREATE POLICY "revision_sets: writable by editors"
  ON revision_sets FOR ALL
  USING (effective_script_role(script_id, auth.uid()) IN ('editor', 'owner'))
  WITH CHECK (effective_script_role(script_id, auth.uid()) IN ('editor', 'owner'));

-- ── scripts.current_revision_set_id ───────────────────────────────────────────

ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS current_revision_set_id UUID REFERENCES revision_sets(id) ON DELETE SET NULL;
