require('dotenv').config();
const mongoose = require('mongoose');
const tmdbCacheService = require('./services/tmdbCacheService');

async function runDebug() {
    console.log('--- Starting Debug Script ---');

    // 1. Check Env Vars
    console.log('TMDB_API_KEY present:', !!process.env.TMDB_API_KEY);
    console.log('MONGODB_URI present:', !!process.env.MONGODB_URI);

    // 2. Connect to DB
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected Successfully');
    } catch (err) {
        console.error('MongoDB Connection Failed:', err.message);
        // Continue anyway to test API fallback
    }

    // 3. Test Trending Fetch
    try {
        console.log('Testing getTrending(weekly)...');
        const data = await tmdbCacheService.getTrending('weekly');
        console.log('Success! Items fetched:', data?.length);
    } catch (err) {
        console.error('getTrending Failed:', err.message);
        if (err.response) {
            console.error('API Response Status:', err.response.status);
            console.error('API Response Data:', JSON.stringify(err.response.data));
        }
        console.error('Full Stack:', err.stack);
    }

    // 4. Test Series Fetch (one example)
    try {
        console.log('Testing getSeriesDetails(1399)...'); // Game of Thrones
        const data = await tmdbCacheService.getSeriesDetails(1399);
        console.log('Success! Series found:', data?.name);
    } catch (err) {
        console.error('getSeriesDetails Failed:', err.message);
    }

    // Clean up
    await mongoose.connection.close();
    console.log('--- Debug Script Finished ---');
}

runDebug();
