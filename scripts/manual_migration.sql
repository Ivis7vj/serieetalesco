CREATE TABLE IF NOT EXISTS diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    series_name TEXT,
    poster_path TEXT,
    rating NUMERIC(3, 1),
    review_text TEXT,
    entry_type TEXT,
    watched_at TIMESTAMP
    WITH
        TIME ZONE,
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

CREATE INDEX IF NOT EXISTS idx_diary_user ON diary_entries (user_id);

CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries (watched_at DESC);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diary_entries' AND policyname = 'Enable all access for diary') THEN
        CREATE POLICY "Enable all access for diary" ON diary_entries FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;