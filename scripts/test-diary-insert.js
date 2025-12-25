const { createClient } = require('@supabase/supabase-js');

// Configuration (Hardcoded for debug script)
const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConnection() {
    console.log("📡 Checking Connection to Supabase...");
    const { data, error } = await supabase.from('episode_reviews').select('count', { count: 'exact', head: true });
    if (error) {
        console.error("❌ Connection Check Failed:", error.message);
        return false;
    }
    console.log("✅ Connection OK. Found episode_reviews table.");
    return true;
}

async function testInsert() {
    if (!await checkConnection()) return;

    console.log("🚀 Testing Supabase Diary Insertion...");

    const testId = `test_user_${Date.now()}`;
    const payload = {
        user_id: testId,
        tmdb_id: 12345,
        season_number: 1,
        series_name: "Debug Series",
        poster_path: "/debug_poster.jpg",
        rating: 5,
        review_text: "Debug review content",
        entry_type: 'DEBUG',
        watched_at: new Date().toISOString()
    };

    console.log("📄 Payload:", payload);

    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .upsert(payload)
            .select();

        if (error) {
            console.error("❌ INSERT FAILED:", error);
            if (error.code === '42P01') {
                console.error("💡 Reason: Table 'diary_entries' does not exist.");
            } else if (error.code === '42501') {
                console.error("💡 Reason: RLS Policy violation (Permission Denied).");
            }
        } else {
            console.log("✅ INSERT SUCCESS:", data);

            // Cleanup
            console.log("Cleaning up test entry...");
            await supabase.from('diary_entries').delete().eq('user_id', testId);
        }

    } catch (e) {
        console.error("❌ UNEXPECTED ERROR:", e);
    }
}

testInsert();
