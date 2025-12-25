require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL;

console.log('Testing TMDB Connection...');
console.log(`API Key: ${TMDB_API_KEY ? 'Present' : 'Missing'}`);
console.log(`Base URL: ${TMDB_BASE_URL}`);

async function testConnection() {
    try {
        console.log('Attempting to fetch trending from TMDB...');
        const res = await axios.get(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`, { timeout: 5000 });
        console.log('TMDB Success! Status:', res.status);
        console.log('Results count:', res.data.results?.length);
    } catch (error) {
        console.error('TMDB Failed!');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data));
        } else if (error.request) {
            console.error('No response received (Timeout/Network)');
        }
    }
}

testConnection();
