-- ============================================
-- WATCHED SERIES MIGRATIONS TABLE
-- Purpose: Track which series have been migrated from Firebase to Supabase
-- This prevents Firebase from ever overriding Supabase data after first interaction
-- ============================================

CREATE TABLE IF NOT EXISTS public.watched_series_migrations (
    user_id TEXT NOT NULL,
    tmdb_id BIGINT NOT NULL,
    migrated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tmdb_id)
);

-- Enable Row Level Security
ALTER TABLE public.watched_series_migrations ENABLE ROW LEVEL SECURITY;

-- Drop old open-access policy if exists
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.watched_series_migrations;

-- User-scoped RLS policies (as per Phase 2.3 refinement)
CREATE POLICY "watched_migrations_read_own"
ON public.watched_series_migrations FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "watched_migrations_insert_own"
ON public.watched_series_migrations FOR INSERT
WITH CHECK (user_id = auth.uid()::text);

-- Note: No UPDATE or DELETE policies - migrations are append-only