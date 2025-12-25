-- CRITICAL FIX: Update RLS policies to allow Firebase users to write/update/delete
-- Since we are using Firebase Auth, Supabase's auth.uid() is null.
-- We must allow operations based on application logic for now.

-- ==========================================
-- SEASON REVIEWS
-- ==========================================
ALTER TABLE season_reviews DISABLE ROW LEVEL SECURITY;

ALTER TABLE season_reviews ENABLE ROW LEVEL SECURITY;

-- Allow reading (already was true)
DROP POLICY IF EXISTS "Users can read all season reviews" ON season_reviews;

CREATE POLICY "Users can read all season reviews" ON season_reviews FOR
SELECT USING (true);

-- Allow inserting (Changed from auth.uid check to true)
DROP POLICY IF EXISTS "Users can insert own season reviews" ON season_reviews;

CREATE POLICY "Users can insert own season reviews" ON season_reviews FOR
INSERT
WITH
    CHECK (true);

-- Allow updating (Changed from auth.uid check to true)
DROP POLICY IF EXISTS "Users can update own season reviews" ON season_reviews;

CREATE POLICY "Users can update own season reviews" ON season_reviews FOR
UPDATE USING (true);

-- Allow deleting (Changed from auth.uid check to true)
DROP POLICY IF EXISTS "Users can delete own season reviews" ON season_reviews;

CREATE POLICY "Users can delete own season reviews" ON season_reviews FOR DELETE USING (true);

-- ==========================================
-- EPISODE REVIEWS
-- ==========================================
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

-- ==========================================
-- RATINGS (Fix these too just in case)
-- ==========================================
-- Season Ratings
DROP POLICY IF EXISTS "Users can insert own season ratings" ON season_ratings;

CREATE POLICY "Users can insert own season ratings" ON season_ratings FOR
INSERT
WITH
    CHECK (true);

DROP POLICY IF EXISTS "Users can update own season ratings" ON season_ratings;

CREATE POLICY "Users can update own season ratings" ON season_ratings FOR
UPDATE USING (true);

-- Episode Ratings
DROP POLICY IF EXISTS "Users can insert own ratings" ON episode_ratings;

CREATE POLICY "Users can insert own ratings" ON episode_ratings FOR
INSERT
WITH
    CHECK (true);

DROP POLICY IF EXISTS "Users can update own ratings" ON episode_ratings;

CREATE POLICY "Users can update own ratings" ON episode_ratings FOR
UPDATE USING (true);