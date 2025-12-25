-- ====================================================================
-- FINAL FIX: ADD ALL MISSING COLUMNS TO REVIEW TABLES
-- Run this script in your Supabase Dashboard -> SQL Editor
-- ====================================================================

-- 1. FIX EPISODE REVIEWS
-- We need episode_number, series_name, and poster_path
ALTER TABLE episode_reviews
ADD COLUMN IF NOT EXISTS episode_number INTEGER,
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS poster_path TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. FIX SEASON REVIEWS
-- We need series_name and poster_path
ALTER TABLE season_reviews
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS poster_path TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 3. VERIFY
-- After running, you can run this to verify:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'episode_reviews';