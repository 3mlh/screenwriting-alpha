-- ── Profile display name improvements ────────────────────────────────────────
--
-- 1. Allow any authenticated user to read any profile (needed for member lists
--    to show display names — the existing "read own" policy blocked joins).
-- 2. Update trigger to default display_name to email when not provided.
-- 3. Backfill existing users who still have an empty display_name.

-- ── RLS: allow members to see each other's display names ─────────────────────

DROP POLICY IF EXISTS "profiles: authenticated can read" ON profiles;

CREATE POLICY "profiles: authenticated can read"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── Trigger: default display_name to email ────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NEW.email,
      ''
    )
  );
  RETURN NEW;
END;
$$;

-- ── Backfill: set display_name = email for users with empty display_name ──────

UPDATE public.profiles p
SET display_name = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.display_name IS NULL OR p.display_name = '')
  AND u.email IS NOT NULL;
