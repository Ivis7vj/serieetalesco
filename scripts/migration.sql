-- ============================================
-- SUPABASE MIGRATION: Reviews & Ratings Tables
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- PHASE 2.1: REVIEWS TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS episode_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    review_text TEXT,
    rating NUMERIC(3, 1),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        UNIQUE (
            user_id,
            tmdb_id,
            season_number,
            episode_number
        )
);

CREATE INDEX IF NOT EXISTS idx_episode_reviews_user ON episode_reviews (user_id);

CREATE INDEX IF NOT EXISTS idx_episode_reviews_tmdb ON episode_reviews (tmdb_id);

CREATE INDEX IF NOT EXISTS idx_episode_reviews_created ON episode_reviews (created_at DESC);

ALTER TABLE episode_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all episode reviews" ON episode_reviews;

CREATE POLICY "Users can read all episode reviews" ON episode_reviews FOR
SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own episode reviews" ON episode_reviews;

CREATE POLICY "Users can insert own episode reviews" ON episode_reviews FOR
INSERT
WITH
    CHECK (true);

DROP POLICY IF EXISTS "Users can update own episode reviews" ON episode_reviews;

CREATE POLICY "Users can update own episode reviews" ON episode_reviews FOR
UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete own episode reviews" ON episode_reviews;

CREATE POLICY "Users can delete own episode reviews" ON episode_reviews FOR DELETE USING (true);

-- Season Reviews Table
CREATE TABLE IF NOT EXISTS season_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    review_text TEXT,
    rating NUMERIC(3, 1),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        UNIQUE (
            user_id,
            tmdb_id,
            season_number
        )
);

CREATE INDEX IF NOT EXISTS idx_season_reviews_user ON season_reviews (user_id);

CREATE INDEX IF NOT EXISTS idx_season_reviews_tmdb ON season_reviews (tmdb_id);

CREATE INDEX IF NOT EXISTS idx_season_reviews_created ON season_reviews (created_at DESC);

ALTER TABLE season_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all season reviews" ON season_reviews;

CREATE POLICY "Users can read all season reviews" ON season_reviews FOR
SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own season reviews" ON season_reviews;

CREATE POLICY "Users can insert own season reviews" ON season_reviews FOR
INSERT
WITH
    CHECK (true);

DROP POLICY IF EXISTS "Users can update own season reviews" ON season_reviews;

CREATE POLICY "Users can update own season reviews" ON season_reviews FOR
UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete own season reviews" ON season_reviews;

CREATE POLICY "Users can delete own season reviews" ON season_reviews FOR DELETE USING (true);

-- ============================================
-- PHASE 2.2: RATINGS TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS episode_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    rating NUMERIC(3, 1) NOT NULL CHECK (
        rating >= 0
        AND rating <= 5
    ),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        UNIQUE (
            user_id,
            tmdb_id,
            season_number,
            episode_number
        )
);

CREATE INDEX IF NOT EXISTS idx_episode_ratings_user ON episode_ratings (user_id);

CREATE INDEX IF NOT EXISTS idx_episode_ratings_tmdb ON episode_ratings (tmdb_id);

ALTER TABLE episode_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all ratings" ON episode_ratings;

CREATE POLICY "Users can read all ratings" ON episode_ratings FOR
SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own ratings" ON episode_ratings;

CREATE POLICY "Users can insert own ratings" ON episode_ratings FOR
INSERT
WITH
    CHECK (true);

DROP POLICY IF EXISTS "Users can update own ratings" ON episode_ratings;

CREATE POLICY "Users can update own ratings" ON episode_ratings FOR
UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete own ratings" ON episode_ratings;

CREATE POLICY "Users can delete own ratings" ON episode_ratings FOR DELETE USING (true);

-- Season Ratings Table
CREATE TABLE IF NOT EXISTS season_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    rating NUMERIC(3, 1) NOT NULL CHECK (
        rating >= 0
        AND rating <= 5
    ),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        UNIQUE (
            user_id,
            tmdb_id,
            season_number
        )
);

CREATE INDEX IF NOT EXISTS idx_season_ratings_user ON season_ratings (user_id);

CREATE INDEX IF NOT EXISTS idx_season_ratings_tmdb ON season_ratings (tmdb_id);

ALTER TABLE season_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all season ratings" ON season_ratings;

CREATE POLICY "Users can read all season ratings" ON season_ratings FOR
SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own season ratings" ON season_ratings;

CREATE POLICY "Users can insert own season ratings" ON season_ratings FOR
INSERT
WITH
    CHECK (true);

DROP POLICY IF EXISTS "Users can update own season ratings" ON season_ratings;

CREATE POLICY "Users can update own season ratings" ON season_ratings FOR
UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete own season ratings" ON season_ratings;

CREATE POLICY "Users can delete own season ratings" ON season_ratings FOR DELETE USING (true);