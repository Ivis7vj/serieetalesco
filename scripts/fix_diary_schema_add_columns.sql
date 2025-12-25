-- Fix for missing columns in diary_entries table
ALTER TABLE diary_entries
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS poster_path TEXT;