-- Add username and photo fields to review tables
ALTER TABLE episode_reviews ADD COLUMN IF NOT EXISTS user_name TEXT;

ALTER TABLE episode_reviews ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE season_reviews ADD COLUMN IF NOT EXISTS user_name TEXT;

ALTER TABLE season_reviews ADD COLUMN IF NOT EXISTS photo_url TEXT;