const mongoose = require('mongoose');

const TrendingCacheSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: ['daily', 'weekly', 'new_episodes'], unique: true },
    data: { type: Array, required: true }, // Array of series objects
    fetched_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true }
});

// TTL Index
TrendingCacheSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TrendingCache', TrendingCacheSchema);
