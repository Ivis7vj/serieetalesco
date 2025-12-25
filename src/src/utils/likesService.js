import { supabase } from '../supabase-config';
import { db } from '../firebase-config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * likesService.js
 * 
 * Manages "Likes" (Favorites) for Series, Seasons, and Episodes.
 * STRICT SSOT: Supabase is the single source of truth.
 * Firebase is READ-ONLY fallback.
 * 
 * Rules:
 * 1. Writes go ONLY to Supabase.
 * 2. Reads check Supabase first. If empty, fall back to Firebase (Legacy).
 * 3. Once a user has ≥1 Supabase like, Firebase is ignored.
 * 4. No metadata stored in Supabase (only IDs). Client hydrates data.
 */

const TABLE = 'likes';

/**
 * Robustly parses a TMDB ID, ensuring it's a number.
 */
const parseTmdbId = (id) => {
    if (!id) return null;
    if (typeof id === 'number') return id;
    if (typeof id === 'string' && id.includes('-S')) {
        const numeric = parseInt(id.split('-S')[0]);
        return isNaN(numeric) ? null : numeric;
    }
    const numeric = parseInt(id);
    if (isNaN(numeric) || (typeof id === 'string' && id.match(/[a-z]/i) && !id.includes('-S'))) return null;
    return numeric;
};

export const likesService = {

    /**
     * Cast a vote (Link Series/Season/Episode to User)
     * Upsert to handle potential duplicates (idempotent).
     */
    likeSeries: async (userId, tmdbId) => {
        const { error } = await supabase
            .from(TABLE)
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                item_type: 'SERIES',
                season_number: null,
                episode_number: null
            }, { onConflict: 'user_id, tmdb_id, item_type, season_number, episode_number' });

        if (error) throw error;
        return true;
    },

    unlikeSeries: async (userId, tmdbId) => {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .match({
                user_id: userId,
                tmdb_id: tmdbId,
                item_type: 'SERIES'
            });

        if (error) throw error;
        return true;
    },

    likeSeason: async (userId, tmdbId, seasonNumber) => {
        const { error } = await supabase
            .from(TABLE)
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                item_type: 'SEASON',
                season_number: seasonNumber,
                episode_number: null
            }, { onConflict: 'user_id, tmdb_id, item_type, season_number, episode_number' });

        if (error) throw error;
        return true;
    },

    unlikeSeason: async (userId, tmdbId, seasonNumber) => {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .match({
                user_id: userId,
                tmdb_id: tmdbId,
                item_type: 'SEASON',
                season_number: seasonNumber
            });

        if (error) throw error;
        return true;
    },

    likeEpisode: async (userId, tmdbId, seasonNumber, episodeNumber) => {
        const { error } = await supabase
            .from(TABLE)
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                item_type: 'EPISODE',
                season_number: seasonNumber,
                episode_number: episodeNumber
            }, { onConflict: 'user_id, tmdb_id, item_type, season_number, episode_number' });

        if (error) throw error;
        return true;
    },

    unlikeEpisode: async (userId, tmdbId, seasonNumber, episodeNumber) => {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .match({
                user_id: userId,
                tmdb_id: tmdbId,
                item_type: 'EPISODE',
                season_number: seasonNumber,
                episode_number: episodeNumber
            });

        if (error) throw error;
        return true;
    },

    /**
     * Get all likes for a user.
     * Implements Failover Logic: Supabase -> Firebase
     * Returns minimal objects: { tmdbId, type, season, episode }
     */
    getUserLikes: async (userId) => {
        try {
            // 1. Try Supabase
            const { data: sbData, error } = await supabase
                .from(TABLE)
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;

            if (sbData && sbData.length > 0) {
                // SSOT Active
                return sbData.map(row => {
                    const isSeason = row.item_type === 'SEASON';
                    const isEpisode = row.item_type === 'EPISODE';

                    // Generate Composite ID for Uniqueness (Key)
                    let compositeId = String(row.tmdb_id);
                    if (isSeason) compositeId += `-S${row.season_number}`;
                    if (isEpisode) compositeId += `-S${row.season_number}E${row.episode_number}`;

                    return {
                        id: compositeId,
                        seriesId: row.tmdb_id, // Explicit for Routing
                        tmdbId: row.tmdb_id,
                        type: row.item_type,
                        seasonNumber: row.season_number,
                        episodeNumber: row.episode_number,
                        source: 'supabase'
                    };
                });
            }

            // 2. Fallback to Firebase
            // Note: Firebase usually stores likes in the 'users' collection document
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const fbLikes = userData.likes || [];

                // Filter out non-media likes (e.g. review likes if they are mixed in)
                const mediaLikes = fbLikes.filter(l => !l.type || ['series', 'season', 'episode'].includes(l.type) || !l.item_type); // Adjust filter based on actual FB data structure

                // Normalize Firebase data to match Supabase structure (Minimal)
                return mediaLikes.map(l => {
                    const lId = parseTmdbId(l.seriesId || l.id);
                    if (!lId) return null;

                    const isSeason = l.type === 'season' || (l.seasonNumber && !l.episodeNumber);
                    const isEpisode = l.type === 'episode' || (l.seasonNumber && l.episodeNumber);

                    let compositeId = String(lId);
                    if (isSeason) compositeId += `-S${l.seasonNumber}`;
                    if (isEpisode) compositeId += `-S${l.seasonNumber}E${l.episodeNumber}`;

                    return {
                        id: compositeId,
                        seriesId: lId,
                        tmdbId: lId,
                        type: isEpisode ? 'EPISODE' : (isSeason ? 'SEASON' : 'SERIES'),
                        seasonNumber: l.seasonNumber || null,
                        episodeNumber: l.episodeNumber || null,
                        source: 'firebase_legacy'
                    };
                }).filter(l => l !== null);
            }

            return [];
        } catch (err) {
            console.error("Error fetching likes:", err);
            return [];
        }
    },

    /**
     * Check if a specific item is liked.
     * Optimized to check local state or do a quick query.
     * (Actually, usually we fetch all likes on load, but for individual button state we might check)
     */
    isLiked: async (userId, tmdbId, type = 'SERIES', seasonNum = null, episodeNum = null) => {
        // Since we usually load all likes into context, this might be redundant if used from UI context,
        // but useful for direct checks.
        // We will just fetch all likes for the user (cached) or specific query?
        // Let's do a specific query for "Is this liked?"

        try {
            // 1. Supabase Check
            let query = supabase
                .from(TABLE)
                .select('id')
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId)
                .eq('item_type', type);

            if (seasonNum !== null) query = query.eq('season_number', seasonNum);
            if (episodeNum !== null) query = query.eq('episode_number', episodeNum);

            const { data, error } = await query.maybeSingle();

            if (data) return true; // Found in Supabase

            // If Supabase has ANY likes for this user, we stop (Block fallback)
            // But checking "ANY" is expensive every time. 
            // Better strategy: rely on the assumption "If we didn't find it in Supabase, check Firebase ONLY IF Migration hasn't happened".
            // But we don't have a migration flag.
            // "Once Supabase has >= 1 like -> Firebase ignored"

            const { count } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', userId);
            if (count > 0) return false; // User has migrated, so if not found above, it's not liked.

            // 2. Firebase Fallback
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const list = userSnap.data().likes || [];
                // Check list
                return list.some(l => {
                    const lId = l.seriesId || l.id;
                    const lSeason = l.seasonNumber;
                    const lEpisode = l.episodeNumber;

                    if (String(lId) !== String(tmdbId)) return false;

                    if (type === 'EPISODE') return String(lSeason) === String(seasonNum) && String(lEpisode) === String(episodeNum);
                    if (type === 'SEASON') return String(lSeason) === String(seasonNum) && !lEpisode;
                    return !lSeason && !lEpisode;
                });
            }
            return false;
        } catch (e) {
            console.error("isLiked check failed", e);
            return false;
        }
    }
};
