-- ====================================================================
-- FIX: ADD MISSING COLUMNS TO REVIEW TABLES
-- Run this script in your Supabase Dashboard -> SQL Editor
-- ====================================================================

-- 1. FIX EPISODE REVIEWS
ALTER TABLE episode_reviews
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS poster_path TEXT;

-- 2. FIX SEASON REVIEWS
ALTER TABLE season_reviews
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS poster_path TEXT;

-- 3. VERIFY (Optional: This will just show the column names if you run it after)
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('episode_reviews', 'season_reviews');