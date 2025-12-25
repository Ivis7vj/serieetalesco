import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTable(tableName) {
    console.log(`\n🔍 Checking ${tableName} columns...`);
    const columns = ['user_name', 'photo_url', 'series_name', 'poster_path'];

    for (const col of columns) {
        const { error } = await supabase
            .from(tableName)
            .select(col)
            .limit(1);

        if (error) {
            console.log(`❌ Column '${col}' is MISSING (Error: ${error.message})`);
        } else {
            console.log(`✅ Column '${col}' EXISTS`);
        }
    }
}

async function run() {
    await checkTable('episode_reviews');
    await checkTable('season_reviews');
}

run();
