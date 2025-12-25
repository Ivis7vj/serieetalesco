-- ============================================
-- SUPABASE SCHEMA PATCH: Reviews Metadata
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Add missing columns to episode_reviews
ALTER TABLE episode_reviews
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS poster_path TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add missing columns to season_reviews
ALTER TABLE season_reviews
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS poster_path TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_episode_reviews_series_name ON episode_reviews (series_name);

CREATE INDEX IF NOT EXISTS idx_season_reviews_series_name ON season_reviews (series_name);

-- Verification Query
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE
    table_name IN (
        'episode_reviews',
        'season_reviews'
    )
    AND column_name IN (
        'series_name',
        'poster_path',
        'user_name',
        'photo_url'
    )
ORDER BY table_name, column_name;