import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFetch(tmdbId) {
    console.log(`\n🔍 Testing fetch with tmdbId: ${tmdbId} (type: ${typeof tmdbId})`);

    const { data, error } = await supabase
        .from('episode_reviews')
        .select('*')
        .eq('tmdb_id', tmdbId)
        .limit(1);

    if (error) {
        console.log(`❌ Error:`, error.message);
    } else {
        console.log(`✅ Success! Found ${data.length} reviews.`);
        if (data.length > 0) {
            console.log(`   Sample review ID: ${data[0].id}`);
            console.log(`   tmdb_id from DB: ${data[0].tmdb_id} (type: ${typeof data[0].tmdb_id})`);
        }
    }
}

async function run() {
    const testId = "106379"; // From user's screen
    await testFetch(testId);
    await testFetch(parseInt(testId));
}

run();
