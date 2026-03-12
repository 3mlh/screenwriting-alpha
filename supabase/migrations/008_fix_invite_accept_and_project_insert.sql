-- ── Fix: invite accept + project INSERT RLS ───────────────────────────────────
--
-- Two bugs fixed here:
--
-- 1. project_members/script_members had no INSERT policy for invited users.
--    acceptInvite() runs as the recipient, who isn't an owner yet — so
--    addProjectMember/addScriptMember silently failed (caught by try/catch).
--    Fix: add policies that let a user insert themselves as a member when
--    a valid pending invite exists for them.
--
-- 2. Creating a new project could fail if the projects INSERT policy was
--    dropped by M3 but not recreated (e.g. partial migration run).
--    Fix: idempotent recreate of the INSERT policy.

-- ── 1. Allow invited users to accept project invites ──────────────────────────

DROP POLICY IF EXISTS "project_members: invited users can accept" ON project_members;

CREATE POLICY "project_members: invited users can accept"
  ON project_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.invites
      WHERE resource_type = 'project'
        AND resource_id = project_id
        AND invited_user_id = auth.uid()
        AND status = 'pending'
    )
  );

-- ── 2. Allow invited users to accept script invites ───────────────────────────

DROP POLICY IF EXISTS "script_members: invited users can accept" ON script_members;

CREATE POLICY "script_members: invited users can accept"
  ON script_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.invites
      WHERE resource_type = 'script'
        AND resource_id = script_id
        AND invited_user_id = auth.uid()
        AND status = 'pending'
    )
  );

-- ── 3. Ensure projects INSERT policy is correct ───────────────────────────────
-- Idempotent: drop whichever version exists, recreate the correct one.

DROP POLICY IF EXISTS "projects: owner can insert" ON projects;
DROP POLICY IF EXISTS "projects: authenticated can create" ON projects;

CREATE POLICY "projects: authenticated can create"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);
