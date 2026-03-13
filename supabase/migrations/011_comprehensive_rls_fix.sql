-- ── 011: Comprehensive idempotent RLS fix ────────────────────────────────────
--
-- Why this is needed:
-- Migration 010 ended with `ALTER PUBLICATION supabase_realtime ADD TABLE scripts`.
-- If scripts was already in the publication (Supabase sometimes adds all tables
-- by default), this threw an error that rolled back the ENTIRE migration 010
-- transaction — leaving none of its policy fixes applied.
--
-- This migration wraps the publication statement safely and re-applies every
-- critical fix in a single idempotent pass.

-- ── 1. Helper functions (CREATE OR REPLACE — always safe) ────────────────────

CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION project_role(p_project_id UUID, p_user_id UUID)
RETURNS permission_level LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT role FROM public.project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION effective_script_role(p_script_id UUID, p_user_id UUID)
RETURNS permission_level LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.script_members
     WHERE script_id = p_script_id AND user_id = p_user_id),
    (SELECT pm.role FROM public.project_members pm
     JOIN public.scripts s ON s.project_id = pm.project_id
     WHERE s.id = p_script_id AND pm.user_id = p_user_id)
  );
$$;

-- ── 2. Creator triggers (DROP/CREATE — always safe) ──────────────────────────

CREATE OR REPLACE FUNCTION add_project_creator_as_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION add_project_creator_as_owner();

CREATE OR REPLACE FUNCTION add_script_creator_as_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.script_members (script_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_script_created ON scripts;
CREATE TRIGGER on_script_created
  AFTER INSERT ON scripts
  FOR EACH ROW EXECUTE FUNCTION add_script_creator_as_owner();

-- ── 3. Backfill project_members and script_members ───────────────────────────
--
-- Projects/scripts created before the triggers ran (or before this fix)
-- never had member rows inserted. Without these rows, project_role() returns
-- NULL and the scripts INSERT RLS WITH CHECK silently blocks all inserts.

INSERT INTO project_members (project_id, user_id, role, invited_by)
  SELECT id, created_by, 'owner', created_by FROM projects
  ON CONFLICT DO NOTHING;

INSERT INTO script_members (script_id, user_id, role, invited_by)
  SELECT id, created_by, 'owner', created_by FROM scripts
  ON CONFLICT DO NOTHING;

-- ── 4. Projects policies ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "projects: owner can select"             ON projects;
DROP POLICY IF EXISTS "projects: members can select"           ON projects;
CREATE POLICY "projects: members can select"
  ON projects FOR SELECT
  USING (is_project_member(id, auth.uid()));

DROP POLICY IF EXISTS "projects: owner can insert"             ON projects;
DROP POLICY IF EXISTS "projects: authenticated can create"     ON projects;
CREATE POLICY "projects: authenticated can create"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "projects: owner can update"             ON projects;
DROP POLICY IF EXISTS "projects: editors and owners can update" ON projects;
CREATE POLICY "projects: editors and owners can update"
  ON projects FOR UPDATE
  USING (project_role(id, auth.uid()) IN ('owner', 'editor'));

DROP POLICY IF EXISTS "projects: owner can delete"             ON projects;
DROP POLICY IF EXISTS "projects: owners can delete"            ON projects;
CREATE POLICY "projects: owners can delete"
  ON projects FOR DELETE
  USING (project_role(id, auth.uid()) = 'owner');

-- ── 5. Scripts policies ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "scripts: owner can select"              ON scripts;
DROP POLICY IF EXISTS "scripts: accessible members can select" ON scripts;
CREATE POLICY "scripts: accessible members can select"
  ON scripts FOR SELECT
  USING (effective_script_role(id, auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "scripts: owner can insert"                        ON scripts;
DROP POLICY IF EXISTS "scripts: project editors and owners can create"   ON scripts;
CREATE POLICY "scripts: project editors and owners can create"
  ON scripts FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND project_role(project_id, auth.uid()) IN ('owner', 'editor')
  );

DROP POLICY IF EXISTS "scripts: owner can update"              ON scripts;
DROP POLICY IF EXISTS "scripts: editors and owners can update" ON scripts;
CREATE POLICY "scripts: editors and owners can update"
  ON scripts FOR UPDATE
  USING (effective_script_role(id, auth.uid()) IN ('owner', 'editor'));

DROP POLICY IF EXISTS "scripts: owner can delete"  ON scripts;
DROP POLICY IF EXISTS "scripts: owners can delete" ON scripts;
CREATE POLICY "scripts: owners can delete"
  ON scripts FOR DELETE
  USING (effective_script_role(id, auth.uid()) = 'owner');

-- ── 6. Realtime publication (wrapped — never aborts the migration) ────────────

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE scripts;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- already in publication, fine
  WHEN undefined_object THEN NULL;   -- publication doesn't exist, fine
END;
$$;
