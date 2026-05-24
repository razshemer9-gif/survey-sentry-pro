-- ============================================================================
-- user_templates: per-user checklist templates, synced across devices.
--
-- Each user can create, read, update, and delete only their own templates.
-- The built-in default template lives in the app code (not in this table).
--
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_templates (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at bigint,
  updated_at bigint
);

CREATE INDEX IF NOT EXISTS user_templates_user_id_idx
  ON user_templates (user_id);

ALTER TABLE user_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own templates" ON user_templates;
CREATE POLICY "Users read own templates"
  ON user_templates FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own templates" ON user_templates;
CREATE POLICY "Users insert own templates"
  ON user_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own templates" ON user_templates;
CREATE POLICY "Users update own templates"
  ON user_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own templates" ON user_templates;
CREATE POLICY "Users delete own templates"
  ON user_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Verify
SELECT count(*) AS template_count FROM user_templates;
