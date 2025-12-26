-- ============================================
-- UPDATE USER POSTERS: Support Season-Level Customization
-- ============================================

-- 1. Add season_number column if it doesn't exist
ALTER TABLE public.user_posters
ADD COLUMN IF NOT EXISTS season_number INTEGER DEFAULT 0;

-- 2. Update Primary Key to support multiple posters per series (one per season)
-- Note: Existing entries will have season_number = 0
ALTER TABLE public.user_posters
DROP CONSTRAINT IF EXISTS user_posters_pkey;

ALTER TABLE public.user_posters
ADD PRIMARY KEY (
    user_id,
    series_id,
    season_number
);

-- 3. Confirm RLS (re-applying just in case)
ALTER TABLE public.user_posters ENABLE ROW LEVEL SECURITY;