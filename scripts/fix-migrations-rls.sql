-- ============================================
-- FIX RLS POLICY FOR WATCHED MIGRATIONS
-- Purpose: Revert to permissive RLS policy because Supabase auth is not synced with Firebase
-- Error 42501 (RLS Violation) occurs because auth.uid() is null/anon while user_id is a Firebase UID
-- ============================================

-- Drop the strict policies
DROP POLICY IF EXISTS "watched_migrations_read_own" ON public.watched_series_migrations;

DROP POLICY IF EXISTS "watched_migrations_insert_own" ON public.watched_series_migrations;

-- Create permissive policy (Trusted Client Model)
-- Matches the pattern used in 'watched_episodes' and other tables
CREATE POLICY "Enable all access for authenticated users" ON public.watched_series_migrations FOR ALL USING (true)
WITH
    CHECK (true);

-- Explanation:
-- Since we use Firebase for Auth and Supabase as a data store, the Supabase client
-- connection is technically "Anonymous" or doesn't share the Firebase User ID context.
-- Therefore `auth.uid()` does not match the `user_id` column.
-- We must trust the client application (which checks currentUser.uid) to write correctly.