const mongoose = require('mongoose');

const SeriesCacheSchema = new mongoose.Schema({
    tmdb_id: { type: Number, required: true, unique: true },
    data: { type: Object, required: true },
    fetched_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true }
});

// TTL Index: Documents expire when 'expires_at' matches current time
SeriesCacheSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('SeriesCache', SeriesCacheSchema);
