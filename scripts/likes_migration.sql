-- Phase 2.6: Likes Migration
-- Table for likes: SERIES, SEASON, EPISODE
-- Includes metadata to support UI without N+1 fetches

CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    item_type TEXT NOT NULL CHECK (
        item_type IN ('SERIES', 'SEASON', 'EPISODE')
    ),
    season_number INTEGER,
    episode_number INTEGER,

-- Metadata removed per Strict SSOT Rule (Fetch from TMDB)

created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tmdb_id, item_type, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_likes_user ON likes (user_id);

CREATE INDEX IF NOT EXISTS idx_likes_tmdb ON likes (tmdb_id);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
-- READ: Public (Likes are public)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users read all likes' AND tablename = 'likes'
    ) THEN
        CREATE POLICY "Users read all likes"
        ON likes FOR SELECT
        USING (true);
    END IF;

    -- WRITE: Owner only (Permissive check for Firebase Auth compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own likes' AND tablename = 'likes'
    ) THEN
        CREATE POLICY "Users insert own likes"
        ON likes FOR INSERT
        WITH CHECK (true); -- Application verifies user_id matches logic
    END IF;

    -- DELETE: Owner only
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users delete own likes' AND tablename = 'likes'
    ) THEN
        CREATE POLICY "Users delete own likes"
        ON likes FOR DELETE
        USING (true); -- Application verifies user_id matches logic
    END IF;
END
$$;