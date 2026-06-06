-- ============================================================================
-- Add survey_type column to accessibility_requirements
--
-- This makes the findings database multi-disciplinary:
--   accessibility       — סקר נגישות נכים (all existing rows)
--   education_safety    — סקר בטיחות מוסדות חינוך
--   general_safety      — סקר בטיחות כללי
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE accessibility_requirements
  ADD COLUMN IF NOT EXISTS survey_type text DEFAULT 'accessibility';

-- Backfill all existing rows that have no value set
UPDATE accessibility_requirements
  SET survey_type = 'accessibility'
  WHERE survey_type IS NULL OR survey_type = '';

-- Verify
SELECT
  survey_type,
  COUNT(*) AS count
FROM accessibility_requirements
GROUP BY survey_type
ORDER BY survey_type;
