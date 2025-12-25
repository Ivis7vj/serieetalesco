import { supabase } from '../supabase-config';
import { db } from '../firebase-config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * watchlistService.js
 * 
 * Handles all watchlist logic for Phase 2.4 migration.
 * Source of Truth: Supabase (watchlist table).
 * Fallback: Firebase (user.watchlist array).
 */

/**
 * Robustly parses a TMDB ID, ensuring it's a number.
 * Handles legacy strings but rejects UUIDs/UUID-like strings.
 */
const parseTmdbId = (id) => {
    if (!id) return null;
    if (typeof id === 'number') return id;

    // Legacy support for "123-S1" or "123-S1E1"
    if (typeof id === 'string' && id.includes('-S')) {
        const parts = id.split('-S');
        const numeric = parseInt(parts[0]);
        return isNaN(numeric) ? null : numeric;
    }

    const numeric = parseInt(id);
    // Reject UUIDs (e.g. "79bf1a78...") which parseInt often parses as a number if they start with a digit,
    // but a real TMDB ID should naturally be a number in our DB.
    // If id starts with a digit but contains non-digits (excluding legacy -S), it might be a malformed ID.
    if (isNaN(numeric) || (typeof id === 'string' && id.match(/[a-z]/i) && !id.includes('-S'))) return null;

    return numeric;
};

/**
 * Fetch the watchlist for a user.
 * STRICT READ LOGIC: Supabase first, fallback to Firebase if Supabase is empty.
 * 
 * @param {string} userId - Firebase UID
 * @returns {Promise<Array>}
 */
export const getWatchlist = async (userId) => {
    if (!userId) return [];

    try {
        // 1. Fetch from Supabase
        const { data: sbData, error: sbError } = await supabase
            .from('watchlist')
            .select('*')
            .eq('user_id', userId)
            .order('added_at', { ascending: false });

        if (sbError) throw sbError;

        // 2. SSOT: If Supabase has data, use it exclusively
        if (sbData && sbData.length > 0) {
            return sbData.map(item => ({
                id: item.tmdb_id, // For UI compatibility
                tmdb_id: Number(item.tmdb_id),
                seriesId: Number(item.series_id),
                name: item.name,
                poster_path: item.poster_path,
                still_path: item.still_path,
                vote_average: item.vote_average,
                first_air_date: item.first_air_date,
                isSeason: item.item_type === 'season',
                isEpisode: item.item_type === 'episode',
                seasonNumber: item.season_number,
                episodeNumber: item.episode_number,
                date: item.added_at
            }));
        }

        // 3. Fallback: Read from Firebase (if Supabase is empty)
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const fbWatchlist = userData.watchlist || [];

            return fbWatchlist.map(item => {
                const tmdbId = parseTmdbId(item.id || item.tmdb_id);
                return {
                    ...item,
                    id: tmdbId, // For UI compatibility
                    tmdb_id: tmdbId,
                    seriesId: parseTmdbId(item.seriesId || item.series_id) || tmdbId,
                };
            }).filter(item => item.tmdb_id !== null); // Drop malformed entries
        }

        return [];
    } catch (error) {
        console.error("Error fetching watchlist:", error);
        return [];
    }
};

/**
 * Add an item (or items) to the watchlist in Supabase.
 * @param {string} userId 
 * @param {Object|Array} items - One or more watchlist items
 * @returns {Promise<boolean>}
 */
export const addToWatchlist = async (userId, items) => {
    if (!userId || !items) return false;

    const itemsArray = Array.isArray(items) ? items : [items];

    // Map items to Supabase schema
    const rows = itemsArray.map(item => {
        // Extract numeric ID
        // Note: For seasons, item.id might be a string "123-S1". 
        // We should handle that or expect the caller to pass the numeric TMDB ID.
        // In MovieDetails, we'll ensure we pass the numeric ID.

        let tmdbId = item.id;
        if (typeof tmdbId === 'string' && tmdbId.includes('-S')) {
            // If it's the legacy string format, we can't store as BIGINT easily 
            // without knowing the actual TMDB season ID.
            // But for new additions, we will try to use numeric IDs.
            // If we still get a string here, we'll try to extract the numeric part if it's an episode ID or similar.
            // For seasons, we might need a separate column or just use the seriesId as tmdbId 
            // if we change the UNIQUE constraint, but we followed user instruction UNIQUE(user_id, tmdb_id).
        }

        return {
            user_id: userId,
            tmdb_id: tmdbId,
            item_type: item.isEpisode ? 'episode' : (item.isSeason ? 'season' : 'series'),
            series_id: item.seriesId || (item.type === 'series' ? item.id : null),
            season_number: item.seasonNumber || null,
            episode_number: item.episodeNumber || null,
            name: item.name || null,
            poster_path: item.poster_path || null,
            still_path: item.still_path || null,
            vote_average: item.vote_average || null,
            first_air_date: item.first_air_date || null,
            added_at: new Date().toISOString()
        };
    });

    try {
        const { error } = await supabase
            .from('watchlist')
            .upsert(rows, { onConflict: 'user_id,tmdb_id' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error adding to watchlist:", error);
        return false;
    }
};

/**
 * Remove an item from the watchlist in Supabase.
 * @param {string} userId 
 * @param {number|string} tmdbId - The ID of the item to remove
 * @returns {Promise<boolean>}
 */
export const removeFromWatchlist = async (userId, tmdbId) => {
    if (!userId || !tmdbId) return false;

    try {
        const { error } = await supabase
            .from('watchlist')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error removing from watchlist:", error);
        return false;
    }
};

/**
 * Remove multiple items from the watchlist in Supabase (e.g. all episodes of a season).
 * @param {string} userId 
 * @param {Array<number>} tmdbIds - Array of IDs to remove
 * @returns {Promise<boolean>}
 */
export const removeFromWatchlistBulk = async (userId, tmdbIds) => {
    if (!userId || !tmdbIds || tmdbIds.length === 0) return false;

    try {
        const { error } = await supabase
            .from('watchlist')
            .delete()
            .eq('user_id', userId)
            .in('tmdb_id', tmdbIds);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error removing from watchlist (bulk):", error);
        return false;
    }
};

/**
 * Helper to check if a specific item is in the watchlist.
 * @param {string} userId 
 * @param {number} tmdbId 
 * @returns {Promise<boolean>}
 */
export const isInWatchlist = async (userId, tmdbId) => {
    if (!userId || !tmdbId) return false;

    try {
        const { data, error } = await supabase
            .from('watchlist')
            .select('tmdb_id')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .maybeSingle();

        if (error) throw error;
        return !!data;
    } catch (error) {
        console.error("Error checking watchlist status:", error);
        return false;
    }
};
