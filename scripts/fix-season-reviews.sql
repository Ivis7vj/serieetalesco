-- CRITICAL FIX: Add missing columns to season_reviews table
-- This is WHY season reviews are failing!

-- First, check if columns exist
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE
    table_name = 'season_reviews'
ORDER BY ordinal_position;

-- Add the missing columns (if not already added)
ALTER TABLE season_reviews ADD COLUMN IF NOT EXISTS user_name TEXT;

ALTER TABLE season_reviews ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Verify they were added
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE
    table_name = 'season_reviews'
ORDER BY ordinal_position;

-- Also verify episode_reviews has them too
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE
    table_name = 'episode_reviews'
ORDER BY ordinal_position;