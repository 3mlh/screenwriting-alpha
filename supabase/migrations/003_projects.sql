-- ── Projects ──────────────────────────────────────────────────────────────────

CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  description TEXT,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_created_by ON projects(created_by);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
--
-- M2: owner-only access.
-- M3 will add project_members table and expand these policies to cover shared access.

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: owner can select"
  ON projects FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "projects: owner can insert"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "projects: owner can update"
  ON projects FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "projects: owner can delete"
  ON projects FOR DELETE
  USING (auth.uid() = created_by);

-- ── Project memberships (foundation for M3) ───────────────────────────────────
--
-- Intentionally minimal in M2 — table exists, no RLS policies using it yet.
-- M3 will add policies that call into this table and add invite/role workflows.

CREATE TYPE permission_level AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       permission_level NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES profiles(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_project_members_user_id ON project_members(user_id);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- M3 will add SELECT/INSERT/UPDATE/DELETE policies here.
-- For now, no rows are inserted via the app — the owner just owns the project directly.
