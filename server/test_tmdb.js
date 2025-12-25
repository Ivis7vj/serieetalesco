const axios = require('axios');
require('dotenv').config();

const TMDB_API_KEY = process.env.TMDB_API_KEY || '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

async function testTMDB() {
    console.log('--- Testing TMDB API Connectivity ---');
    console.time('TMDB Fetch');
    try {
        const url = `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`;
        console.log(`Fetching: ${url}`);
        const res = await axios.get(url, { timeout: 10000 });
        console.log('Status:', res.status);
        console.log('Results:', res.data.results?.length);
    } catch (error) {
        console.error('TMDB Error:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    }
    console.timeEnd('TMDB Fetch');
}

testTMDB();
