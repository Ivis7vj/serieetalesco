-- ============================================
-- PHASE 2.4: WATCHLIST TABLE
-- Purpose: Store user watchlist in Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.watchlist (
    user_id TEXT NOT NULL,
    tmdb_id BIGINT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'series', -- 'series', 'season', 'episode'
    series_id BIGINT,
    season_number INT,
    episode_number INT,
    name TEXT,
    poster_path TEXT,
    still_path TEXT,
    vote_average FLOAT,
    first_air_date TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tmdb_id)
);

-- Enable RLS
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

-- Permissive policies (Consistent with the project's current "Trusted Client" model)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.watchlist;

CREATE POLICY "Enable all access for authenticated users" ON public.watchlist FOR ALL USING (true)
WITH
    CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist (user_id);