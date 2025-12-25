-- ====================================================================
-- FIX: ALLOW WRITES FOR FIREBASE USERS
-- Run this script in your Supabase Dashboard -> SQL Editor
-- ====================================================================

-- 1. EPISODE REVIEWS
ALTER TABLE episode_reviews ENABLE ROW LEVEL SECURITY;

-- Allow reading (Public)
DROP POLICY IF EXISTS "Users can read all episode reviews" ON episode_reviews;

CREATE POLICY "Users can read all episode reviews" ON episode_reviews FOR
SELECT USING (true);

-- Allow inserting (Public/Firebase users)
DROP POLICY IF EXISTS "Users can insert own episode reviews" ON episode_reviews;

CREATE POLICY "Users can insert own episode reviews" ON episode_reviews FOR
INSERT
WITH
    CHECK (true);

-- Allow updating (Public/Firebase users)
DROP POLICY IF EXISTS "Users can update own episode reviews" ON episode_reviews;

CREATE POLICY "Users can update own episode reviews" ON episode_reviews FOR
UPDATE USING (true);

-- Allow deleting (Public/Firebase users)
DROP POLICY IF EXISTS "Users can delete own episode reviews" ON episode_reviews;

CREATE POLICY "Users can delete own episode reviews" ON episode_reviews FOR DELETE USING (true);

-- 2. SEASON REVIEWS
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

-- 3. EPISODE RATINGS
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

-- 4. SEASON RATINGS
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