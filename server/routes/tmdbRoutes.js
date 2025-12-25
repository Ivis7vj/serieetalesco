const express = require('express');
const router = express.Router();
const tmdbCacheService = require('../services/tmdbCacheService');

// Get Series Details
router.get('/series/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid TMDB ID (Must be numeric)' });
    }
    try {
        const data = await tmdbCacheService.getSeriesDetails(id);
        res.json(data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ message: error.message });
    }
});

// Get Season Details
router.get('/series/:id/season/:seasonNumber', async (req, res) => {
    const id = Number(req.params.id);
    const sn = Number(req.params.seasonNumber);
    if (isNaN(id) || isNaN(sn)) {
        return res.status(400).json({ message: 'Invalid Parameters (ID and Season must be numeric)' });
    }
    try {
        const data = await tmdbCacheService.getSeasonDetails(id, sn);
        res.json(data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ message: error.message });
    }
});

// Get Trending
router.get('/trending', async (req, res) => {
    try {
        const type = req.query.type || 'weekly';
        const data = await tmdbCacheService.getTrending(type);
        res.json(data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ message: error.message });
    }
});

// Get New Episodes (Hero)
router.get('/hero/new-episodes', async (req, res) => {
    try {
        const data = await tmdbCacheService.getNewEpisodes();
        res.json(data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ message: error.message });
    }
});

module.exports = router;
