const mongoose = require('mongoose');

const SeasonCacheSchema = new mongoose.Schema({
    tmdb_id: { type: Number, required: true },
    season_number: { type: Number, required: true },
    data: { type: Object, required: true },
    fetched_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true }
});

// User Compound Index for fast lookup
SeasonCacheSchema.index({ tmdb_id: 1, season_number: 1 }, { unique: true });

// TTL Index
SeasonCacheSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SeasonCache', SeasonCacheSchema);
