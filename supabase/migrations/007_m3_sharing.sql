-- ── M3: Sharing / Authorization ───────────────────────────────────────────────
--
-- Expands from M2 owner-only access to invite-based membership.
-- Key concepts:
--   - project_members and script_members rows determine access
--   - Creators are auto-inserted as owner on row creation (triggers below)
--   - Script-level role overrides project-level (effective_script_role)
--   - Invites sit in pending state until accepted by the recipient
--   - Email lookup goes through auth.users (SECURITY DEFINER, never exposed)

-- ── 1. Profiles: broaden SELECT for member lists ───────────────────────────────
--
-- Members need to see each other's display names and avatars.
-- Email is never exposed — invite lookup uses a SECURITY DEFINER function.

DROP POLICY "profiles: read own" ON profiles;

CREATE POLICY "profiles: authenticated users can read"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── 2. Helper functions ────────────────────────────────────────────────────────
--
-- All SECURITY DEFINER + SET search_path = '' to prevent search path injection.
-- Called from RLS policies and from application Route Handlers via supabase.rpc().

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

-- Script-level role overrides project-level. Returns NULL if user has no access.
CREATE OR REPLACE FUNCTION effective_script_role(p_script_id UUID, p_user_id UUID)
RETURNS permission_level LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT COALESCE(
    -- 1. Explicit script-level membership takes priority
    (SELECT role FROM public.script_members
     WHERE script_id = p_script_id AND user_id = p_user_id),
    -- 2. Inherit from project membership
    (SELECT pm.role FROM public.project_members pm
     JOIN public.scripts s ON s.project_id = pm.project_id
     WHERE s.id = p_script_id AND pm.user_id = p_user_id)
  );
$$;

-- Looks up a user by email via auth.users (never exposes the email itself).
-- Returns the profile id and display_name for the invite confirmation UI.
CREATE OR REPLACE FUNCTION lookup_user_by_email(p_email TEXT)
RETURNS TABLE(user_id UUID, display_name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT p.id, p.display_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = p_email;
$$;

-- ── 3. Auto-insert creator as owner ───────────────────────────────────────────
--
-- Ensures every project/script always has at least one owner row, so
-- is_project_member() and project_role() work from the moment of creation.

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

CREATE TRIGGER on_script_created
  AFTER INSERT ON scripts
  FOR EACH ROW EXECUTE FUNCTION add_script_creator_as_owner();

-- Backfill existing rows so current owners have member entries.
INSERT INTO project_members (project_id, user_id, role, invited_by)
  SELECT id, created_by, 'owner', created_by FROM projects
  ON CONFLICT DO NOTHING;

INSERT INTO script_members (script_id, user_id, role, invited_by)
  SELECT id, created_by, 'owner', created_by FROM scripts
  ON CONFLICT DO NOTHING;

-- ── 4. project_members RLS policies ───────────────────────────────────────────

CREATE POLICY "project_members: members can select"
  ON project_members FOR SELECT
  USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "project_members: owners can insert"
  ON project_members FOR INSERT
  WITH CHECK (project_role(project_id, auth.uid()) = 'owner');

CREATE POLICY "project_members: owners can update"
  ON project_members FOR UPDATE
  USING (project_role(project_id, auth.uid()) = 'owner');

CREATE POLICY "project_members: owners can delete"
  ON project_members FOR DELETE
  USING (project_role(project_id, auth.uid()) = 'owner');

-- ── 5. script_members RLS policies ────────────────────────────────────────────

CREATE POLICY "script_members: accessible members can select"
  ON script_members FOR SELECT
  USING (effective_script_role(script_id, auth.uid()) IS NOT NULL);

CREATE POLICY "script_members: owners can insert"
  ON script_members FOR INSERT
  WITH CHECK (effective_script_role(script_id, auth.uid()) = 'owner');

CREATE POLICY "script_members: owners can update"
  ON script_members FOR UPDATE
  USING (effective_script_role(script_id, auth.uid()) = 'owner');

CREATE POLICY "script_members: owners can delete"
  ON script_members FOR DELETE
  USING (effective_script_role(script_id, auth.uid()) = 'owner');

-- ── 6. Replace M2 owner-only policies on projects ─────────────────────────────

DROP POLICY "projects: owner can select" ON projects;
DROP POLICY "projects: owner can insert" ON projects;
DROP POLICY "projects: owner can update" ON projects;
DROP POLICY "projects: owner can delete" ON projects;

CREATE POLICY "projects: members can select"
  ON projects FOR SELECT
  USING (is_project_member(id, auth.uid()));

CREATE POLICY "projects: authenticated can create"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "projects: editors and owners can update"
  ON projects FOR UPDATE
  USING (project_role(id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "projects: owners can delete"
  ON projects FOR DELETE
  USING (project_role(id, auth.uid()) = 'owner');

-- ── 7. Replace M2 owner-only policies on scripts ──────────────────────────────

DROP POLICY "scripts: owner can select" ON scripts;
DROP POLICY "scripts: owner can insert" ON scripts;
DROP POLICY "scripts: owner can update" ON scripts;
DROP POLICY "scripts: owner can delete" ON scripts;

CREATE POLICY "scripts: accessible members can select"
  ON scripts FOR SELECT
  USING (effective_script_role(id, auth.uid()) IS NOT NULL);

CREATE POLICY "scripts: project editors and owners can create"
  ON scripts FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND project_role(project_id, auth.uid()) IN ('owner', 'editor')
  );

CREATE POLICY "scripts: editors and owners can update"
  ON scripts FOR UPDATE
  USING (effective_script_role(id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "scripts: owners can delete"
  ON scripts FOR DELETE
  USING (effective_script_role(id, auth.uid()) = 'owner');

-- ── 8. Update script_snapshots policies to allow editor+ ──────────────────────

DROP POLICY "snapshots: owner can insert" ON script_snapshots;

CREATE POLICY "snapshots: editors can insert"
  ON script_snapshots FOR INSERT
  WITH CHECK (
    auth.uid() = taken_by
    AND effective_script_role(script_id, auth.uid()) IN ('owner', 'editor')
  );

-- ── 9. Invites table ──────────────────────────────────────────────────────────
--
-- Pending invites are visible to the recipient on their dashboard.
-- Accepting creates the member row and marks the invite accepted.
-- Declining marks it declined without granting access.

CREATE TABLE invites (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_type    TEXT NOT NULL CHECK (resource_type IN ('project', 'script')),
  resource_id      UUID NOT NULL,
  invited_user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role             permission_level NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invites_invited_user ON invites(invited_user_id, status);
CREATE INDEX idx_invites_resource     ON invites(resource_type, resource_id);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Recipient sees their own invites; sender can see invites they sent (to cancel).
CREATE POLICY "invites: participants can select"
  ON invites FOR SELECT
  USING (auth.uid() = invited_user_id OR auth.uid() = invited_by);

-- Sender inserts (resource-level ownership enforced in Route Handler).
CREATE POLICY "invites: sender can insert"
  ON invites FOR INSERT
  WITH CHECK (auth.uid() = invited_by);

-- Only the recipient can update status (accept/decline).
CREATE POLICY "invites: recipient can update status"
  ON invites FOR UPDATE
  USING (auth.uid() = invited_user_id)
  WITH CHECK (auth.uid() = invited_user_id);

-- Sender can delete (cancel) a pending invite.
CREATE POLICY "invites: sender can delete"
  ON invites FOR DELETE
  USING (auth.uid() = invited_by);
