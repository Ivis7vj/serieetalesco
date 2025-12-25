import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testReviewWrite() {
    const randomId = Math.floor(Math.random() * 10000);
    const userId = `test-user-${randomId}`;
    const tmdbId = 55555;

    console.log(`🧪 Attempting to write a Season Review for user ${userId}...`);

    const payload = {
        user_id: userId,
        tmdb_id: tmdbId,
        season_number: 1,
        review_text: "This is a debug test review from the write script.",
        rating: 4.5, // 0-5 scale
        user_name: "DebugBot",
        photo_url: "https://placehold.co/100"
    };

    console.log("Payload:", payload);

    const { data, error } = await supabase
        .from('season_reviews')
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error("❌ FAILED to write review:", error);
    } else {
        console.log("✅ SUCCESS! Review written:", data);
    }
}

testReviewWrite();
