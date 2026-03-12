-- ── Scripts ───────────────────────────────────────────────────────────────────
--
-- Canonical screenplay content is stored as blocks JSONB.
-- The block array is the unit of consistency — always read/written atomically.
-- Never store Lexical editor state here; only the serialized Block[].

CREATE TABLE scripts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  format     TEXT NOT NULL DEFAULT 'feature'
               CHECK (format IN ('feature', 'pilot', 'spec', 'short')),
  blocks     JSONB NOT NULL DEFAULT '[]',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scripts_project_id ON scripts(project_id);
CREATE INDEX idx_scripts_created_by ON scripts(created_by);
CREATE INDEX idx_scripts_blocks_gin ON scripts USING GIN (blocks);

CREATE TRIGGER scripts_updated_at
  BEFORE UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
--
-- M2: owner-only access.
-- M3 will expand to script_members + effective_script_role() function.

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scripts: owner can select"
  ON scripts FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "scripts: owner can insert"
  ON scripts FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "scripts: owner can update"
  ON scripts FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "scripts: owner can delete"
  ON scripts FOR DELETE
  USING (auth.uid() = created_by);

-- ── Script members (foundation for M3) ───────────────────────────────────────

CREATE TABLE script_members (
  script_id  UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       permission_level NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES profiles(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (script_id, user_id)
);

CREATE INDEX idx_script_members_user_id ON script_members(user_id);

ALTER TABLE script_members ENABLE ROW LEVEL SECURITY;

-- M3 will add policies here.

-- ── Script snapshots (foundation for M4) ─────────────────────────────────────
--
-- Full JSONB copy of blocks at a point in time.
-- Diffs are computed at read time from stable block UUIDs — never stored.
-- M4 will add autosave cadence, revision sets, and restore workflows.

CREATE TABLE script_snapshots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id    UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  blocks       JSONB NOT NULL,
  taken_by     UUID NOT NULL REFERENCES profiles(id),
  taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label        TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual'
                 CHECK (trigger_type IN ('manual', 'autosave', 'revision_open', 'revision_close'))
);

CREATE INDEX idx_snapshots_script_id_taken_at
  ON script_snapshots(script_id, taken_at DESC);

ALTER TABLE script_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots: owner can select"
  ON script_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scripts s
      WHERE s.id = script_id AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "snapshots: owner can insert"
  ON script_snapshots FOR INSERT
  WITH CHECK (
    auth.uid() = taken_by
    AND EXISTS (
      SELECT 1 FROM scripts s
      WHERE s.id = script_id AND s.created_by = auth.uid()
    )
  );
