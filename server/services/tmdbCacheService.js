const axios = require('axios');
const https = require('https');
const mongoose = require('mongoose');
const SeriesCache = require('../models/SeriesCache');
const SeasonCache = require('../models/SeasonCache');
const TrendingCache = require('../models/TrendingCache');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';

// --- ROBUST TMDB CLIENT ---
const tmdbClient = axios.create({
    timeout: 8000,
    httpsAgent: new https.Agent({ keepAlive: true }),
    family: 4
});

// --- HELPER: TTL CALCULATION ---
const getExpiry = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);

// --- HELPER: IMMUTABLE DATA RETURN ---
const cleanData = (data) => JSON.parse(JSON.stringify(data));

// --- HELPER: FIRE-AND-FORGET STORE ---
const storeInCacheAsync = (Model, query, data, ttlHours) => {
    if (mongoose.connection.readyState !== 1) return;

    Model.findOneAndUpdate(
        query,
        {
            ...query,
            data: cleanData(data),
            expires_at: getExpiry(ttlHours),
            fetched_at: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).then(() => {
        // Silent success
    }).catch(err => {
        console.warn(`[CACHE] Async Store Error: ${err.message}`);
    });
};

// --- 1. SERIES DETAILS ---
const getSeriesDetails = async (tmdbId) => {
    const id = Number(tmdbId);
    if (isNaN(id)) {
        throw new Error('Invalid TMDB ID');
    }

    // 1. Check Cache First (SPEED!)
    if (mongoose.connection.readyState === 1) {
        try {
            const cached = await SeriesCache.findOne({ tmdb_id: id }).lean();
            if (cached && cached.expires_at > new Date()) {
                console.log(`[CACHE HIT] Series ${id}`);
                return cleanData(cached.data);
            }
        } catch (err) {
            console.warn(`[CACHE READ ERROR] Series ${id}: ${err.message}`);
        }
    }

    // 2. Cache Miss or Expired -> Fetch TMDB
    try {
        console.log(`[TMDB FETCH] Series ${id}`);
        const res = await tmdbClient.get(`${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,images,videos,external_ids,recommendations,similar,content_ratings,reviews,watch/providers,translations`);
        const data = res.data;

        // 3. Update Cache in Background
        storeInCacheAsync(SeriesCache, { tmdb_id: id }, data, 24);

        return cleanData(data);
    } catch (apiErr) {
        // Fallback: If TMDB fails, try returning EXPIRED cache as last resort
        if (mongoose.connection.readyState === 1) {
            const expired = await SeriesCache.findOne({ tmdb_id: id }).lean();
            if (expired) {
                console.log(`[CACHE FALLBACK] Returning expired data for Series ${id}`);
                return cleanData(expired.data);
            }
        }
        throw apiErr;
    }
};

// --- 2. SEASON DETAILS ---
const getSeasonDetails = async (tmdbId, seasonNumber) => {
    const id = Number(tmdbId);
    const sn = Number(seasonNumber);
    if (isNaN(id) || isNaN(sn)) {
        throw new Error('Invalid TMDB Parameters');
    }

    // 1. Check Cache First
    if (mongoose.connection.readyState === 1) {
        try {
            const cached = await SeasonCache.findOne({ tmdb_id: id, season_number: sn }).lean();
            if (cached && cached.expires_at > new Date()) {
                console.log(`[CACHE HIT] Season ${id} S${sn}`);
                return cleanData(cached.data);
            }
        } catch (err) {
            console.warn(`[CACHE READ ERROR] Season ${id} S${sn}: ${err.message}`);
        }
    }

    // 2. Cache Miss or Expired -> Fetch TMDB
    try {
        console.log(`[TMDB FETCH] Season ${id} S${sn}`);
        const res = await tmdbClient.get(`${TMDB_BASE_URL}/tv/${id}/season/${sn}?api_key=${TMDB_API_KEY}&append_to_response=images,videos,credits`);
        const data = res.data;

        // 3. Update Cache in Background
        storeInCacheAsync(SeasonCache, { tmdb_id: id, season_number: sn }, data, 24);

        return cleanData(data);
    } catch (apiErr) {
        // Fallback
        if (mongoose.connection.readyState === 1) {
            const expired = await SeasonCache.findOne({ tmdb_id: id, season_number: sn }).lean();
            if (expired) {
                return cleanData(expired.data);
            }
        }
        throw apiErr;
    }
};

// --- 3. TRENDING ---
const getTrending = async (type = 'weekly') => {
    const safeType = ['daily', 'weekly'].includes(type) ? type : 'weekly';
    const apiWindow = safeType === 'weekly' ? 'week' : 'day';

    // 1. Check Cache First
    if (mongoose.connection.readyState === 1) {
        try {
            const cached = await TrendingCache.findOne({ type: safeType }).lean();
            if (cached && cached.expires_at > new Date()) {
                console.log(`[CACHE HIT] Trending ${safeType}`);
                return cleanData(cached.data);
            }
        } catch (err) {
            console.warn(`[CACHE READ ERROR] Trending ${safeType}: ${err.message}`);
        }
    }

    // 2. Cache Miss or Expired -> Fetch TMDB
    try {
        console.log(`[TMDB FETCH] Trending ${safeType}`);
        const res = await tmdbClient.get(`${TMDB_BASE_URL}/trending/tv/${apiWindow}?api_key=${TMDB_API_KEY}`);
        const data = res.data.results;

        // 3. Update Cache in Background
        storeInCacheAsync(TrendingCache, { type: safeType }, data, 6);

        return cleanData(data);
    } catch (apiErr) {
        // Fallback
        if (mongoose.connection.readyState === 1) {
            const expired = await TrendingCache.findOne({ type: safeType }).lean();
            if (expired) {
                return cleanData(expired.data);
            }
        }
        throw apiErr;
    }
};

// --- 4. NEW EPISODES (HERO CAROUSEL) ---
const getNewEpisodes = async () => {
    const CACHE_KEY = 'new_episodes';

    // A. PRIMARY: TMDB
    try {
        console.log(`[TMDB] FETCH new episodes logic`);

        // 1. Fetch "On The Air" (Candidate List)
        const res = await tmdbClient.get(`${TMDB_BASE_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}&timezone=America/New_York`);
        let candidates = res.data.results || [];

        // 2. Sort by popularity to prioritize relevant shows
        candidates.sort((a, b) => b.popularity - a.popularity);

        // 3. Process top candidates (limit to top 15 to check)
        // We need DETAILS to get 'last_episode_to_air' reliably
        const topCandidates = candidates.slice(0, 15);
        const detailedSeries = [];

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const now = new Date();

        for (const candidate of topCandidates) {
            try {
                // Reuse our existing getSeriesDetails (which caches!)
                const details = await getSeriesDetails(candidate.id);

                // 4. Strict Filter: Must have a NEW episode released recently
                if (details.last_episode_to_air) {
                    const airDate = new Date(details.last_episode_to_air.air_date);
                    // Check if aired in last 7 days and is not in future (allow Today)
                    if (airDate >= sevenDaysAgo && airDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
                        detailedSeries.push(details);
                    }
                }
            } catch (err) {
                console.warn(`[Hero] Failed to verify candidate ${candidate.name}: ${err.message}`);
            }
        }

        // Return top 5 verified hits
        const finalData = detailedSeries.slice(0, 5);

        // B. STORE ASYNC
        storeInCacheAsync(TrendingCache, { type: CACHE_KEY }, finalData, 6);

        return cleanData(finalData);
    } catch (apiErr) {
        // C. FALLBACK
        console.error(`[TMDB ERROR] New Episodes: ${apiErr.message} -> Checking Fallback`);
        if (mongoose.connection.readyState === 1) {
            try {
                const cached = await TrendingCache.findOne({ type: CACHE_KEY }).lean().maxTimeMS(500);
                if (cached) {
                    console.log(`[FALLBACK] HIT new episodes`);
                    return cleanData(cached.data);
                }
            } catch (mongoErr) {
                console.error(`[FALLBACK ERROR] New Episodes: ${mongoErr.message}`);
            }
        }
        throw apiErr;
    }
};

module.exports = {
    getSeriesDetails,
    getSeasonDetails,
    getTrending,
    getNewEpisodes
};
