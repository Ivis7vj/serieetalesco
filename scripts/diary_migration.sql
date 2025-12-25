-- Phase 2.5: Diary Migration
-- Table for major milestones: SEASON_COMPLETED, SEASON_RATED, SERIES_COMPLETED

CREATE TABLE IF NOT EXISTS diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    entry_type TEXT NOT NULL CHECK (
        entry_type IN (
            'SEASON_COMPLETED',
            'SEASON_RATED',
            'SERIES_COMPLETED'
        )
    ),
    season_number INTEGER,
    rating NUMERIC(3, 1),
    series_name TEXT,
    poster_path TEXT,
    watched_at DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (
        user_id,
        tmdb_id,
        entry_type,
        season_number
    )
);

CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries (user_id, watched_at DESC);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users read own diary' AND tablename = 'diary_entries'
    ) THEN
        CREATE POLICY "Users read own diary"
        ON diary_entries FOR SELECT
        USING (user_id = auth.uid()::text);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own diary' AND tablename = 'diary_entries'
    ) THEN
        CREATE POLICY "Users insert own diary"
        ON diary_entries FOR INSERT
        WITH CHECK (user_id = auth.uid()::text);
    END IF;
END
$$;