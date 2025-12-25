import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumnTypes() {
    console.log('🔍 Checking season_reviews Column Types...');

    // We fetch a sample and inspect the type if possible, or use logic.
    // Ideally we query information_schema but via JS client it's hard without raw sql rpc.
    // We will try to insert a NON-UUID string to user_id and see if it fails.

    const testId = 'firebase-style-uid-' + Math.floor(Math.random() * 1000); // Definitely NOT a UUID

    const { data, error } = await supabase
        .from('season_reviews')
        .insert([{
            user_id: testId,
            tmdb_id: 12345,
            season_number: 1,
            review_text: "Type Test",
            rating: 5
        }])
        .select()
        .single();

    if (error) {
        console.error('❌ Insert Failed. Likely Type Mismatch:', error.message);
        if (error.message.includes('uuid')) {
            console.log('⚠️ DIAGNOSIS: user_id column is Type UUID. Firebase UIDs are TEXT. This is the cause.');
        }
    } else {
        console.log('✅ Insert Succeeded (user_id is TEXT). Type is compatible.');
        // Clean up
        await supabase.from('season_reviews').delete().eq('id', data.id);
    }
}

checkColumnTypes();
