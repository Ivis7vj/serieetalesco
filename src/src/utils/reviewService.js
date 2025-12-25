import { supabase } from '../supabase-config';
import { db } from '../firebase-config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

/**
 * Review Service
 * 
 * Handles all review operations with Supabase as primary source and Firebase as fallback.
 * 
 * Write operations: Supabase ONLY
 * Read operations: Supabase first, Firebase fallback
 */

// ==================== WRITE OPERATIONS (Supabase ONLY) ====================

/**
 * Create a new episode review
 */
export const createEpisodeReview = async (userId, tmdbId, seasonNumber, episodeNumber, reviewText, rating, userName, photoUrl, seriesName, posterPath) => {
    try {
        const { data, error } = await supabase
            .from('episode_reviews')
            .insert([{
                user_id: userId,
                tmdb_id: tmdbId,
                season_number: seasonNumber,
                episode_number: episodeNumber,
                review_text: reviewText,
                rating: rating,
                user_name: userName,
                photo_url: photoUrl,
                series_name: seriesName,
                poster_path: posterPath
            }])
            .select()
            .single();

        if (error) {
            console.error('Supabase Error (createEpisodeReview):', error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        console.error('Error creating episode review:', error);
        return { success: false, error };
    }
};

/**
 * Create a new season review
 */
export const createSeasonReview = async (userId, tmdbId, seasonNumber, review, rating, userName, userPhoto, seriesName, posterPath) => {
    try {
        const payload = {
            user_id: userId,
            tmdb_id: tmdbId,
            season_number: seasonNumber,
            review_text: review,
            rating: rating,
            user_name: userName,
            photo_url: userPhoto,
            series_name: seriesName,
            poster_path: posterPath
        };
        console.log("🚀 Supabase Season Review Payload:", payload);
        const { data, error } = await supabase
            .from('season_reviews')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Supabase Error (createSeasonReview):', error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        console.error('Error creating season review:', error);
        return { success: false, error }; // Propagate specific error if needed
    }
};

/**
 * Update an existing episode review
 */
export const updateEpisodeReview = async (reviewId, reviewText, rating) => {
    try {
        const { data, error } = await supabase
            .from('episode_reviews')
            .update({
                review_text: reviewText,
                rating: rating,
                updated_at: new Date().toISOString()
            })
            .eq('id', reviewId)
            .select()
            .single();

        if (error) {
            console.error('Supabase Error (updateEpisodeReview):', error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        console.error('Error updating episode review:', error);
        return { success: false, error };
    }
};

/**
 * Update an existing season review
 */
export const updateSeasonReview = async (reviewId, reviewText, rating) => {
    try {
        const { data, error } = await supabase
            .from('season_reviews')
            .update({
                review_text: reviewText,
                rating: rating,
                updated_at: new Date().toISOString()
            })
            .eq('id', reviewId)
            .select()
            .single();

        if (error) {
            console.error('Supabase Error (updateSeasonReview):', error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        console.error('Error updating season review:', error);
        return { success: false, error };
    }
};

/**
 * Delete an episode review
 */
export const deleteEpisodeReview = async (reviewId) => {
    try {
        const { error } = await supabase
            .from('episode_reviews')
            .delete()
            .eq('id', reviewId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting episode review:', error);
        return { success: false, error };
    }
};

/**
 * Delete a season review
 */
export const deleteSeasonReview = async (reviewId) => {
    try {
        const { error } = await supabase
            .from('season_reviews')
            .delete()
            .eq('id', reviewId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting season review:', error);
        return { success: false, error };
    }
};

// ==================== READ OPERATIONS (Supabase → Firebase Fallback) ====================

/**
 * Get episode reviews (Supabase first, Firebase fallback)
 */
export const getEpisodeReviews = async (tmdbId, seasonNumber, episodeNumber) => {
    try {
        const numericId = parseInt(tmdbId);
        const numericSeason = parseInt(seasonNumber);
        const numericEpisode = parseInt(episodeNumber);

        console.log(`[Supabase] Fetching Episode Reviews: ID=${numericId}, S=${numericSeason}, E=${numericEpisode}`);

        // Try Supabase first
        const { data: supabaseData, error } = await supabase
            .from('episode_reviews')
            .select('*')
            .eq('tmdb_id', numericId)
            .eq('season_number', numericSeason)
            .eq('episode_number', numericEpisode)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // If Supabase has data, return it
        if (supabaseData && supabaseData.length > 0) {
            return supabaseData.map(review => ({
                ...review,
                id: review.id,
                userId: review.user_id,
                userName: review.user_name || 'User',
                photoURL: review.photo_url,
                tmdbId: review.tmdb_id,
                seasonNumber: review.season_number,
                episodeNumber: review.episode_number,
                review: review.review_text,
                rating: review.rating?.toString(),
                createdAt: review.created_at,
                isEpisode: true,
                source: 'supabase'
            }));
        }

        // Fallback to Firebase
        const q = query(
            collection(db, 'reviews'),
            where('tmdbId', '==', tmdbId),
            where('seasonNumber', '==', seasonNumber),
            where('episodeNumber', '==', episodeNumber),
            where('isEpisode', '==', true)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            source: 'firebase'
        }));
    } catch (error) {
        console.error('Error fetching episode reviews:', error);
        return [];
    }
};

/**
 * Get season reviews (Supabase first, Firebase fallback)
 */
export const getSeasonReviews = async (tmdbId, seasonNumber) => {
    try {
        const numericId = parseInt(tmdbId);
        const numericSeason = parseInt(seasonNumber);

        console.log(`[Supabase] Fetching Season + Episode Reviews: ID=${numericId}, S=${numericSeason}`);

        // Try Supabase first - Fetch BOTH season and episode reviews for this season
        const [seasonRes, episodeRes] = await Promise.all([
            supabase
                .from('season_reviews')
                .select('*')
                .eq('tmdb_id', numericId)
                .eq('season_number', numericSeason)
                .order('created_at', { ascending: false }),
            supabase
                .from('episode_reviews')
                .select('*')
                .eq('tmdb_id', numericId)
                .eq('season_number', numericSeason)
                .order('created_at', { ascending: false })
        ]);

        if (seasonRes.error) throw seasonRes.error;
        if (episodeRes.error) throw episodeRes.error;

        const supabaseReviews = [
            ...(episodeRes.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                name: r.series_name,
                poster_path: r.poster_path,
                isEpisode: true,
                source: 'supabase'
            })),
            ...(seasonRes.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                name: r.series_name,
                poster_path: r.poster_path,
                isSeason: true,
                source: 'supabase'
            }))
        ];

        console.log(`[Supabase] Season Results: S=${seasonRes.data?.length || 0}, E=${episodeRes.data?.length || 0}`);

        // Firebase fallback
        const q = query(
            collection(db, 'reviews'),
            where('tmdbId', '==', numericId),
            where('seasonNumber', '==', numericSeason)
        );

        const snapshot = await getDocs(q);
        const firebaseReviews = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            source: 'firebase'
        }));

        // Combine and deduplicate
        const allReviews = [...supabaseReviews, ...firebaseReviews];
        const uniqueReviews = allReviews.filter((review, index, self) =>
            index === self.findIndex(r =>
                String(r.userId) === String(review.userId) &&
                String(r.tmdbId) === String(review.tmdbId) &&
                (Number(r.seasonNumber) || 0) === (Number(review.seasonNumber) || 0) &&
                (Number(r.episodeNumber) || 0) === (Number(review.episodeNumber) || 0)
            )
        );

        return uniqueReviews;
    } catch (error) {
        console.error('Error fetching season reviews:', error);
        return [];
    }
};

export const getSeriesReviews = async (tmdbId) => {
    try {
        const numericId = parseInt(tmdbId);
        console.log(`[Supabase] Fetching All Series Reviews: ID=${numericId}`);

        // Get from Supabase
        const [episodeReviews, seasonReviews] = await Promise.all([
            supabase
                .from('episode_reviews')
                .select('*')
                .eq('tmdb_id', numericId)
                .order('created_at', { ascending: false }),
            supabase
                .from('season_reviews')
                .select('*')
                .eq('tmdb_id', numericId)
                .order('created_at', { ascending: false })
        ]);

        console.log(`[Supabase] Results: Episodes=${episodeReviews.data?.length || 0}, Seasons=${seasonReviews.data?.length || 0}`);

        const supabaseReviews = [
            ...(episodeReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                name: r.series_name,
                poster_path: r.poster_path,
                isEpisode: true,
                source: 'supabase'
            })),
            ...(seasonReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                userName: r.user_name || 'User',
                photoURL: r.photo_url,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                name: r.series_name,
                poster_path: r.poster_path,
                isSeason: true,
                source: 'supabase'
            }))
        ];

        // Fallback to Firebase for any missing data
        const q = query(
            collection(db, 'reviews'),
            where('tmdbId', '==', numericId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const firebaseReviews = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            source: 'firebase'
        }));

        // Combine and deduplicate (prefer Supabase)
        const allReviews = [...supabaseReviews, ...firebaseReviews];
        const uniqueReviews = allReviews.filter((review, index, self) =>
            index === self.findIndex(r =>
                String(r.userId) === String(review.userId) &&
                String(r.tmdbId) === String(review.tmdbId) &&
                (Number(r.seasonNumber) || 0) === (Number(review.seasonNumber) || 0) &&
                (Number(r.episodeNumber) || 0) === (Number(review.episodeNumber) || 0)
            )
        );

        return uniqueReviews;
    } catch (error) {
        console.error('Error fetching series reviews:', error);
        return [];
    }
};

/**
 * Get all reviews by a specific user
 */
export const getUserReviews = async (userId) => {
    try {
        // Get from Supabase
        const [episodeReviews, seasonReviews] = await Promise.all([
            supabase
                .from('episode_reviews')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
            supabase
                .from('season_reviews')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
        ]);

        const supabaseReviews = [
            ...(episodeReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                episodeNumber: r.episode_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                name: r.series_name,
                poster_path: r.poster_path,
                isEpisode: true,
                source: 'supabase'
            })),
            ...(seasonReviews.data || []).map(r => ({
                ...r,
                id: r.id,
                userId: r.user_id,
                tmdbId: r.tmdb_id,
                seasonNumber: r.season_number,
                review: r.review_text,
                rating: r.rating?.toString(),
                createdAt: r.created_at,
                name: r.series_name,
                poster_path: r.poster_path,
                isSeason: true,
                source: 'supabase'
            }))
        ];

        // Fallback to Firebase
        const q = query(
            collection(db, 'reviews'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const firebaseReviews = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            source: 'firebase'
        }));

        // Combine and deduplicate
        const allReviews = [...supabaseReviews, ...firebaseReviews];
        const uniqueReviews = allReviews.filter((review, index, self) =>
            index === self.findIndex(r =>
                String(r.userId) === String(review.userId) &&
                String(r.tmdbId) === String(review.tmdbId) &&
                Number(r.seasonNumber) === Number(review.seasonNumber) &&
                Number(r.episodeNumber) === Number(review.episodeNumber)
            )
        );

        return uniqueReviews;
    } catch (error) {
        console.error('Error fetching user reviews:', error);
        return [];
    }
};

