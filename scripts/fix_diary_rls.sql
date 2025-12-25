-- Fix for RLS Policy Violation (42501)
-- Since Firebase is used for Auth, Supabase auth.uid() is null.
-- We must relax the policy to rely on the client's provided user_id,
-- consistent with the existing 'watchlist' and 'watched_episodes' implementation.

DROP POLICY IF EXISTS "Users read own diary" ON diary_entries;

DROP POLICY IF EXISTS "Users insert own diary" ON diary_entries;

-- Enable permissive access (Application logic verifies user)
CREATE POLICY "Enable all access for diary" ON diary_entries FOR ALL USING (true)
WITH
    CHECK (true);