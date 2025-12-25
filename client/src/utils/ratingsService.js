import { supabase } from '../supabase-config';
import { db } from '../firebase-config';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Ratings Service
 * 
 * Handles all rating operations with Supabase as primary source and Firebase as fallback for legacy data.
 * 
 * IMPORTANT: Ratings are treated as PUBLIC data. All users can read all ratings.
 * 
 * Write operations: Supabase ONLY (upsert pattern)
 * Read operations: Supabase first, Firebase fallback for legacy data
 */

// ==================== WRITE OPERATIONS (Supabase ONLY) ====================

/**
 * Set episode rating (upsert)
 * Creates or updates a rating for a specific episode
 */
export const setEpisodeRating = async (userId, tmdbId, seasonNumber, episodeNumber, rating) => {
    try {
        const { data, error } = await supabase
            .from('episode_ratings')
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                season_number: seasonNumber,
                episode_number: episodeNumber,
                rating: rating,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,tmdb_id,season_number,episode_number'
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error setting episode rating:', error);
        return { success: false, error };
    }
};

/**
 * Set season rating (upsert)
 * Creates or updates a rating for a specific season
 */
export const setSeasonRating = async (userId, tmdbId, seasonNumber, rating) => {
    try {
        const { data, error } = await supabase
            .from('season_ratings')
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                season_number: seasonNumber,
                rating: rating,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,tmdb_id,season_number'
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error setting season rating:', error);
        return { success: false, error };
    }
};

// ==================== READ OPERATIONS (Supabase → Firebase Fallback) ====================

/**
 * Get episode rating for a specific user (Supabase first, Firebase fallback)
 */
export const getEpisodeRating = async (userId, tmdbId, seasonNumber, episodeNumber) => {
    try {
        // Try Supabase first
        const { data, error } = await supabase
            .from('episode_ratings')
            .select('*')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

        // If found in Supabase, return it
        if (data) {
            return {
                rating: data.rating,
                source: 'supabase',
                created_at: data.created_at,
                updated_at: data.updated_at
            };
        }

        // Fallback to Firebase (legacy ratings stored in reviews collection)
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('userId', '==', userId),
            where('tmdbId', '==', tmdbId),
            where('seasonNumber', '==', seasonNumber),
            where('episodeNumber', '==', episodeNumber),
            where('isEpisode', '==', true)
        );

        const snapshot = await getDocs(reviewsQuery);
        if (!snapshot.empty) {
            const reviewDoc = snapshot.docs[0].data();
            if (reviewDoc.rating) {
                return {
                    rating: parseFloat(reviewDoc.rating),
                    source: 'firebase',
                    created_at: reviewDoc.createdAt,
                    updated_at: reviewDoc.updatedAt || reviewDoc.createdAt
                };
            }
        }

        return null; // No rating found
    } catch (error) {
        console.error('Error fetching episode rating:', error);
        return null;
    }
};

/**
 * Get season rating for a specific user (Supabase first, Firebase fallback)
 */
export const getSeasonRating = async (userId, tmdbId, seasonNumber) => {
    try {
        // Try Supabase first
        const { data, error } = await supabase
            .from('season_ratings')
            .select('*')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        // If found in Supabase, return it
        if (data) {
            return {
                rating: data.rating,
                source: 'supabase',
                created_at: data.created_at,
                updated_at: data.updated_at
            };
        }

        // Fallback to Firebase (legacy ratings stored in reviews collection)
        const reviewsQuery = query(
            collection(db, 'reviews'),
            where('userId', '==', userId),
            where('tmdbId', '==', tmdbId),
            where('seasonNumber', '==', seasonNumber),
            where('isSeason', '==', true)
        );

        const snapshot = await getDocs(reviewsQuery);
        if (!snapshot.empty) {
            const reviewDoc = snapshot.docs[0].data();
            if (reviewDoc.rating) {
                return {
                    rating: parseFloat(reviewDoc.rating),
                    source: 'firebase',
                    created_at: reviewDoc.createdAt,
                    updated_at: reviewDoc.updatedAt || reviewDoc.createdAt
                };
            }
        }

        return null; // No rating found
    } catch (error) {
        console.error('Error fetching season rating:', error);
        return null;
    }
};

/**
 * Get all episode ratings for a series (PUBLIC - all users)
 * Used for displaying average ratings
 */
export const getSeriesEpisodeRatings = async (tmdbId) => {
    try {
        const { data, error } = await supabase
            .from('episode_ratings')
            .select('*')
            .eq('tmdb_id', tmdbId);

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error fetching series episode ratings:', error);
        return [];
    }
};

/**
 * Get all season ratings for a series (PUBLIC - all users)
 * Used for displaying average ratings
 */
export const getSeriesSeasonRatings = async (tmdbId) => {
    try {
        const { data, error } = await supabase
            .from('season_ratings')
            .select('*')
            .eq('tmdb_id', tmdbId);

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('Error fetching series season ratings:', error);
        return [];
    }
};

/**
 * Get all ratings by a specific user (for profile page)
 */
export const getUserRatings = async (userId) => {
    try {
        const [episodeRatings, seasonRatings] = await Promise.all([
            supabase
                .from('episode_ratings')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false }),
            supabase
                .from('season_ratings')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
        ]);

        return {
            episodes: episodeRatings.data || [],
            seasons: seasonRatings.data || []
        };
    } catch (error) {
        console.error('Error fetching user ratings:', error);
        return { episodes: [], seasons: [] };
    }
};

/**
 * Calculate average rating for an episode (PUBLIC)
 */
export const getEpisodeAverageRating = async (tmdbId, seasonNumber, episodeNumber) => {
    try {
        const { data, error } = await supabase
            .from('episode_ratings')
            .select('rating')
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber);

        if (error) throw error;

        if (!data || data.length === 0) return { average: 0, count: 0 };

        const sum = data.reduce((acc, r) => acc + parseFloat(r.rating), 0);
        return {
            average: (sum / data.length).toFixed(1),
            count: data.length
        };
    } catch (error) {
        console.error('Error calculating episode average rating:', error);
        return { average: 0, count: 0 };
    }
};

/**
 * Calculate average rating for a season (PUBLIC)
 */
export const getSeasonAverageRating = async (tmdbId, seasonNumber) => {
    try {
        const { data, error } = await supabase
            .from('season_ratings')
            .select('rating')
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber);

        if (error) throw error;

        if (!data || data.length === 0) return { average: 0, count: 0 };

        const sum = data.reduce((acc, r) => acc + parseFloat(r.rating), 0);
        return {
            average: (sum / data.length).toFixed(1),
            count: data.length
        };
    } catch (error) {
        console.error('Error calculating season average rating:', error);
        return { average: 0, count: 0 };
    }
};
