-- ============================================================================
-- Add reference_photos column to support MULTIPLE detail photos per requirement
--
-- Background: Previously the schema had only `reference_photo` (single text).
-- The app now supports multiple detail images per finding. This adds a new
-- jsonb column to store an array of dataURLs/URLs.
--
-- Backwards compatibility:
--   - The app reads `reference_photos` first; falls back to `reference_photo`
--     when the array is missing/empty.
--   - On save, the app writes both: `reference_photos` (full array) and
--     `reference_photo` (first element, for legacy readers).
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE accessibility_requirements
  ADD COLUMN IF NOT EXISTS reference_photos jsonb;

-- Optional: backfill existing rows so reference_photos = [reference_photo]
UPDATE accessibility_requirements
SET reference_photos = jsonb_build_array(reference_photo)
WHERE reference_photo IS NOT NULL
  AND reference_photo <> ''
  AND (reference_photos IS NULL OR jsonb_array_length(reference_photos) = 0);

-- Verify
SELECT
  COUNT(*) FILTER (WHERE reference_photo IS NOT NULL AND reference_photo <> '') AS rows_with_legacy_photo,
  COUNT(*) FILTER (WHERE reference_photos IS NOT NULL AND jsonb_array_length(reference_photos) > 0) AS rows_with_array
FROM accessibility_requirements;
