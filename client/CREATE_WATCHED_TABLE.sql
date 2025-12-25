-- ====================================================================
-- FIX: CREATE MISSING WATCHED_EPISODES TABLE
-- Run this in Supabase SQL Editor
-- ====================================================================

CREATE TABLE IF NOT EXISTS watched_episodes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL, -- Firebase UID is text
    tmdb_id BIGINT NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    watched_at TIMESTAMPTZ DEFAULT NOW(),

-- Unique constraint to prevent duplicate watched entries
UNIQUE(user_id, tmdb_id, season_number, episode_number) );

-- Enable RLS
ALTER TABLE watched_episodes ENABLE ROW LEVEL SECURITY;

-- Allow everything for now (Firebase Auth compatibility)
DROP POLICY IF EXISTS "Public Full Access" ON watched_episodes;

CREATE POLICY "Public Full Access" ON watched_episodes FOR ALL USING (true)
WITH
    CHECK (true);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_watched_user_series ON watched_episodes (user_id, tmdb_id);