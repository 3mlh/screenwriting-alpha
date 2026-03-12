-- ── Audit Logs ────────────────────────────────────────────────────────────────
--
-- Append-only event log for access-sensitive operations.
-- Written via service role client only — never directly by the user.
-- SELECT policy is FALSE so no user can read audit logs via the API.

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES profiles(id),
  action        TEXT NOT NULL,       -- e.g. 'script.blocks.update', 'project.create'
  resource_type TEXT NOT NULL,       -- 'script', 'project', 'snapshot'
  resource_id   UUID NOT NULL,
  metadata      JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_resource   ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- No user-facing SELECT. Only readable via service role in admin tooling.
CREATE POLICY "audit_logs: no direct user access"
  ON audit_logs FOR SELECT
  USING (FALSE);

-- ── Block-change audit trigger ─────────────────────────────────────────────────
--
-- Runs in the same DB transaction as the UPDATE — cannot be bypassed by application code.

CREATE OR REPLACE FUNCTION audit_script_blocks_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.blocks IS DISTINCT FROM NEW.blocks THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      auth.uid(),
      'script.blocks.update',
      'script',
      NEW.id,
      jsonb_build_object(
        'title', NEW.title,
        'title_changed', OLD.title IS DISTINCT FROM NEW.title,
        'blocks_changed', TRUE
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER script_blocks_audit_trigger
  AFTER UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION audit_script_blocks_change();
