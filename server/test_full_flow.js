require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const TrendingCache = require('./models/TrendingCache');

const MONGODB_URI = process.env.MONGODB_URI;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;

console.log('--- Full Flow Test ---');

async function run() {
    console.log('1. Connecting to MongoDB...');
    try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        console.log('   MongoDB Connected!');
    } catch (err) {
        console.log('   MongoDB Connection Failed:', err.message);
    }

    console.log('   Connection State:', mongoose.connection.readyState);

    console.log('\n2. Testing Cache Read (with timeout)...');
    if (mongoose.connection.readyState === 1) {
        try {
            const start = Date.now();
            const cached = await TrendingCache.findOne({ type: 'weekly' }).maxTimeMS(2000);
            console.log(`   Read finished in ${Date.now() - start}ms`);
            console.log('   Cache Result:', cached ? 'Found' : 'Null');
        } catch (err) {
            console.log(`   Read Error (Expected if DB blocked): ${err.message}`);
        }
    } else {
        console.log('   Skipping Cache (Not Connected)');
    }

    console.log('\n3. Testing TMDB Fetch...');
    try {
        const start = Date.now();
        const res = await axios.get(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`, { timeout: 5000 });
        console.log(`   TMDB Fetch finished in ${Date.now() - start}ms`);
        console.log('   Status:', res.status);
    } catch (err) {
        console.error('   TMDB Failed:', err.message);
        if (err.response) console.error('   Data:', JSON.stringify(err.response.data));
    }

    console.log('\nDone.');
    process.exit(0);
}

run();
