-- ============================================
-- CONSOLIDATED SETUP FOR MISSING TABLES
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================

-- 1. WATCHLIST TABLE
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

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.watchlist;

CREATE POLICY "Enable all access for authenticated users" ON public.watchlist FOR ALL USING (true)
WITH
    CHECK (true);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist (user_id);

-- 2. USER POSTERS TABLE
CREATE TABLE IF NOT EXISTS public.user_posters (
    user_id TEXT NOT NULL,
    series_id BIGINT NOT NULL,
    poster_path TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, series_id)
);

ALTER TABLE public.user_posters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.user_posters;

CREATE POLICY "Enable all access for authenticated users" ON public.user_posters FOR ALL USING (true)
WITH
    CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_posters_user_id ON public.user_posters (user_id);

-- 3. WATCHED SERIES MIGRATIONS (Just in case it's missing)
CREATE TABLE IF NOT EXISTS public.watched_series_migrations (
    user_id TEXT NOT NULL,
    tmdb_id BIGINT NOT NULL,
    migrated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tmdb_id)
);

ALTER TABLE public.watched_series_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.watched_series_migrations;

CREATE POLICY "Enable all access for authenticated users" ON public.watched_series_migrations FOR ALL USING (true)
WITH
    CHECK (true);