import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
    console.log('🔍 Checking season_reviews columns...');

    // We can't easily DESCRIBE table via JS client without admin rights or RPC.
    // But we can try to select specific columns and see if it errors.

    const { data, error } = await supabase
        .from('season_reviews')
        .select('user_name, photo_url')
        .limit(1);

    if (error) {
        console.error('❌ Columns likely missing or other error:', error.message);
    } else {
        console.log('✅ Columns exist! Data sample:', data);
    }
}

checkColumns();
