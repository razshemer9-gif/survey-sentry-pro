-- Add survey_type column to user_templates
ALTER TABLE user_templates
  ADD COLUMN IF NOT EXISTS survey_type text;

-- Verify
SELECT id, name, survey_type FROM user_templates LIMIT 10;
