import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSeasonRating() {
    console.log('🧪 Testing Season Rating Save (Server-Side)...');

    const userId = 'test-user-debug-' + Date.now();
    const tmdbId = 12345;
    const seasonNumber = 1;
    const rating = 4.5;

    console.log(`Payload: User=${userId}, Series=${tmdbId}, Season=${seasonNumber}, Rating=${rating}`);

    // Direct DB Insert
    const { data, error } = await supabase
        .from('season_ratings')
        .upsert({
            user_id: userId,
            tmdb_id: tmdbId,
            season_number: seasonNumber,
            rating: rating,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id,tmdb_id,season_number'
        })
        .select()
        .single();

    if (error) {
        console.error('❌ FAILED:', error);
    } else {
        console.log('✅ SUCCESS:', data);
    }
}

testSeasonRating();
