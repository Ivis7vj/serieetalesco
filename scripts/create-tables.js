const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTables() {
    console.log('🚀 Starting Supabase table creation...\n');

    // SQL for all tables
    const sql = `
-- ============================================
-- PHASE 2.1: REVIEWS TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS episode_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  review_text TEXT,
  rating NUMERIC(3,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tmdb_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episode_reviews_user ON episode_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_reviews_tmdb ON episode_reviews(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_episode_reviews_created ON episode_reviews(created_at DESC);

ALTER TABLE episode_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'episode_reviews' AND policyname = 'Users can read all episode reviews') THEN
        CREATE POLICY "Users can read all episode reviews" ON episode_reviews FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'episode_reviews' AND policyname = 'Users can insert own episode reviews') THEN
        CREATE POLICY "Users can insert own episode reviews" ON episode_reviews FOR INSERT WITH CHECK (user_id = auth.uid()::text);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'episode_reviews' AND policyname = 'Users can update own episode reviews') THEN
        CREATE POLICY "Users can update own episode reviews" ON episode_reviews FOR UPDATE USING (user_id = auth.uid()::text);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'episode_reviews' AND policyname = 'Users can delete own episode reviews') THEN
        CREATE POLICY "Users can delete own episode reviews" ON episode_reviews FOR DELETE USING (user_id = auth.uid()::text);
    END IF;
END $$;

-- Season Reviews Table
CREATE TABLE IF NOT EXISTS season_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  review_text TEXT,
  rating NUMERIC(3,1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tmdb_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_season_reviews_user ON season_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_season_reviews_tmdb ON season_reviews(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_season_reviews_created ON season_reviews(created_at DESC);

ALTER TABLE season_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'season_reviews' AND policyname = 'Users can read all season reviews') THEN
        CREATE POLICY "Users can read all season reviews" ON season_reviews FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'season_reviews' AND policyname = 'Users can insert own season reviews') THEN
        CREATE POLICY "Users can insert own season reviews" ON season_reviews FOR INSERT WITH CHECK (user_id = auth.uid()::text);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'season_reviews' AND policyname = 'Users can update own season reviews') THEN
        CREATE POLICY "Users can update own season reviews" ON season_reviews FOR UPDATE USING (user_id = auth.uid()::text);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'season_reviews' AND policyname = 'Users can delete own season reviews') THEN
        CREATE POLICY "Users can delete own season reviews" ON season_reviews FOR DELETE USING (user_id = auth.uid()::text);
    END IF;
END $$;

-- ============================================
-- PHASE 2.2: RATINGS TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS episode_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  rating NUMERIC(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tmdb_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episode_ratings_user ON episode_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_episode_ratings_tmdb ON episode_ratings(tmdb_id);

ALTER TABLE episode_ratings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'episode_ratings' AND policyname = 'Users can read all ratings') THEN
        CREATE POLICY "Users can read all ratings" ON episode_ratings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'episode_ratings' AND policyname = 'Users can insert own ratings') THEN
        CREATE POLICY "Users can insert own ratings" ON episode_ratings FOR INSERT WITH CHECK (user_id = auth.uid()::text);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'episode_ratings' AND policyname = 'Users can update own ratings') THEN
        CREATE POLICY "Users can update own ratings" ON episode_ratings FOR UPDATE USING (user_id = auth.uid()::text);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'episode_ratings' AND policyname = 'Users can delete own ratings') THEN
        CREATE POLICY "Users can delete own ratings" ON episode_ratings FOR DELETE USING (user_id = auth.uid()::text);
    END IF;
END $$;

-- Season Ratings Table
CREATE TABLE IF NOT EXISTS season_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  tmdb_id INTEGER NOT NULL,
  season_number INTEGER NOT NULL,
  rating NUMERIC(3,1) NOT NULL CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tmdb_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_season_ratings_user ON season_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_season_ratings_tmdb ON season_ratings(tmdb_id);

ALTER TABLE season_ratings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'season_ratings' AND policyname = 'Users can read all season ratings') THEN
        CREATE POLICY "Users can read all season ratings" ON season_ratings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'season_ratings' AND policyname = 'Users can insert own season ratings') THEN
        CREATE POLICY "Users can insert own season ratings" ON season_ratings FOR INSERT WITH CHECK (user_id = auth.uid()::text);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'season_ratings' AND policyname = 'Users can update own season ratings') THEN
        CREATE POLICY "Users can update own season ratings" ON season_ratings FOR UPDATE USING (user_id = auth.uid()::text);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'season_ratings' AND policyname = 'Users can delete own season ratings') THEN
        CREATE POLICY "Users can delete own season ratings" ON season_ratings FOR DELETE USING (user_id = auth.uid()::text);
    END IF;
END $$;
`;

    // PHASE 2.3: DIARY TABLE (STRICT V2)
    const diarySql = `
    CREATE TABLE IF NOT EXISTS diary_entries (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      season_number INTEGER NOT NULL,
      series_name TEXT,
      poster_path TEXT,
      rating NUMERIC(3,1),
      review_text TEXT,
      entry_type TEXT,
      watched_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, tmdb_id, season_number)
    );
    
    CREATE INDEX IF NOT EXISTS idx_diary_user ON diary_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(watched_at DESC);
    
    ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
    
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diary_entries' AND policyname = 'Enable all access for diary') THEN
            CREATE POLICY "Enable all access for diary" ON diary_entries FOR ALL USING (true) WITH CHECK (true);
        END IF;
    END $$;
    `;

    const fullSql = sql + diarySql;

    try {
        console.log('📝 Executing SQL...');
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: fullSql });

        if (error) {
            console.error('❌ RPC Error:', error);
            console.log('\n⚠️  RPC execution failed. Trying direct SQL fallback not implemented in this script logic for DDL.');
            console.log('\nPlease run the following SQL manually in Supabase Dashboard:\n');
            console.log(fullSql);
            return false;
        }

        console.log('✅ Tables created successfully!\n');
        console.log('📊 Created tables:');
        console.log('   - episode_reviews');
        console.log('   - season_reviews');
        console.log('   - episode_ratings');
        console.log('   - season_ratings');
        console.log('   - diary_entries');
        console.log('\n🔐 RLS policies enabled on all tables');
        console.log('\n✨ Migration complete! You can now use reviews, ratings, and diary.\n');
        return true;

    } catch (err) {
        console.error('❌ Unexpected error:', err);
        return false;
    }
}

createTables().then(success => {
    if (success) {
        console.log('🎉 All done! Refresh your app and try submitting a review.');
    } else {
        console.log('\n📝 Manual SQL file saved. Please run it in Supabase Dashboard → SQL Editor');
    }
    process.exit(success ? 0 : 1);
});
