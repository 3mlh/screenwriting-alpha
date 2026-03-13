-- ── 010: Idempotently fix INSERT RLS policies + triggers ──────────────────────
--
-- Root cause of 403 on project/script creation:
-- Migration 007 used `DROP POLICY "..."` without IF EXISTS. If the policy
-- didn't exist with that exact name (e.g. partial prior migration), the whole
-- migration transaction failed, leaving INSERT policies for projects/scripts
-- never created.
--
-- This migration drops-and-recreates all critical policies idempotently so
-- the DB ends up in the correct state regardless of what ran before.

-- ── 1. Projects INSERT policy ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "projects: owner can insert" ON projects;
DROP POLICY IF EXISTS "projects: authenticated can create" ON projects;

CREATE POLICY "projects: authenticated can create"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- ── 2. Scripts INSERT policy ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "scripts: owner can insert" ON scripts;
DROP POLICY IF EXISTS "scripts: project editors and owners can create" ON scripts;

CREATE POLICY "scripts: project editors and owners can create"
  ON scripts FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND project_role(project_id, auth.uid()) IN ('owner', 'editor')
  );

-- ── 3. Re-ensure project creator trigger ──────────────────────────────────────

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

-- ── 4. Re-ensure script creator trigger ───────────────────────────────────────

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

-- ── 5. Enable Realtime on scripts table (for live collaboration) ──────────────
-- This adds the scripts table to Supabase's replication publication so
-- postgres_changes subscriptions receive UPDATE events.

ALTER PUBLICATION supabase_realtime ADD TABLE scripts;
