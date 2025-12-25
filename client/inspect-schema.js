import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk2ODA1NiwiZXhwIjoyMDgxNTQ0MDU2fQ.rVDfBamctQDEa7s-tbYmqKPeh2ugOJLV0xtIKKHVEpE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable(tableName) {
    console.log(`\n🔍 Inspecting table: ${tableName}`);

    // We try to insert a dummy record with only one known column and see what columns are returned or if it fails.
    // Or better, we use an RPC if available, but usually we don't have one for schema.
    // Let's try to select '*' and look at the first row's keys if any exist.

    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

    if (error) {
        console.log(`❌ Error fetching from ${tableName}:`, error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log(`✅ Table ${tableName} has data. Columns:`, Object.keys(data[0]));
    } else {
        console.log(`ℹ️ Table ${tableName} is empty. Trying to find columns via empty select...`);
        // If empty, we can't easily see columns via select '*'.
        // Let's try to force an error by selecting a non-existent column to see the error message.
        const { error: err2 } = await supabase
            .from(tableName)
            .select('non_existent_column_123');
        console.log(`ℹ️ Error message for non-existent column (for context):`, err2?.message);
    }
}

async function run() {
    await inspectTable('episode_reviews');
    await inspectTable('season_reviews');
}

run();
