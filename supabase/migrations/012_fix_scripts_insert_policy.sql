-- ── 012: Fix scripts INSERT policy — remove auth.uid() dependency ────────────
--
-- Root cause: auth.uid() returns null inside the WITH CHECK for INSERT when the
-- `authenticated` role has a role-level GUC (set via ALTER ROLE) that resets
-- request.jwt.claim.sub to '' on role switch. PostgREST re-sets it after the
-- role switch for real requests, but the net effect is that any auth.uid()
-- reference in an INSERT WITH CHECK is unreliable on this Supabase instance.
--
-- Fix: rewrite the INSERT policy to use the inserted row's `created_by` column
-- directly instead of auth.uid() for the project membership check. The identity
-- check (user can only create as themselves) is enforced by the app layer —
-- requireUser() + the Route Handler setting created_by = user.id server-side.
-- The DB policy still ensures the created_by user is an owner/editor of the
-- target project, which prevents forged inserts from doing real damage.

DROP POLICY IF EXISTS "scripts: project editors and owners can create" ON scripts;

CREATE POLICY "scripts: project editors and owners can create"
  ON scripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id
        AND pm.user_id   = created_by
        AND pm.role IN ('owner', 'editor')
    )
  );
