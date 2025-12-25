import { db } from '../firebase-config';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import * as diaryService from './diaryService';
import * as watchlistService from './watchlistService';
import { likesService } from './likesService';
import * as ratingsService from './ratingsService';

/**
 * Profile Service
 * 
 * Aggregates all profile-related data from Firebase and Supabase.
 * Returns a single object with all necessary data for the Profile page.
 * 
 * Rules:
 * 1. Read-Only (Fetch)
 * 2. Parallel Execution (Promise.all)
 * 3. Strict Data Ownership (Firebase vs Supabase)
 * 4. No TMDB Hydration in Service (Return raw IDs)
 */

export const getUserProfileData = async (userId) => {
    if (!userId) return null;

    try {
        const [
            userSnap,
            diary,
            watchlist,
            likes,
            ratings,
            activitySnap,
            postersResult
        ] = await Promise.all([
            // 1. User Info (Firebase)
            getDoc(doc(db, 'users', userId)),

            // 2. Diary (Supabase)
            diaryService.getUserDiary(userId),

            // 3. Watchlist (Supabase)
            watchlistService.getWatchlist(userId),

            // 4. Likes (Supabase - Raw Data Only)
            likesService.getUserLikes(userId),

            // 5. Ratings (Supabase)
            ratingsService.getUserRatings(userId),

            // 6. Activity Preview (Firebase - Last 10 Items)
            getDocs(query(
                collection(db, 'user_activity'),
                where('userId', '==', userId),
                orderBy('createdAt', 'desc'),
                limit(10)
            )).catch(err => {
                if (err.code === 'failed-precondition' && err.message.includes('index')) {
                    console.warn("⚠️ MISSING FIRESTORE INDEX: Click the link in the console to create it!");
                }
                console.warn("Activity Feed fetch failed:", err);
                return { docs: [] }; // Return mock snapshot
            }),

            // 7. User Posters (Supabase)
            import('../supabase-config').then(({ supabase }) =>
                supabase
                    .from('user_posters')
                    .select('series_id, poster_path')
                    .eq('user_id', userId)
            ).catch(err => {
                console.error("Poster fetch failed:", err);
                return { data: [] };
            })
        ]);

        // Process Firebase Data
        let userInfo = null;
        if (userSnap.exists()) {
            const data = userSnap.data();
            userInfo = {
                ...data,
                username: data.username || data.email?.split('@')[0] || 'User',
                // Ensure arrays exist
                followers: data.followers || [],
                following: data.following || [],
                notifications: data.notifications || [],
                favorites: data.favorites || [],
                achievements: data.achievements || [],
                starSeries: data.starSeries || [],
                bannerBackdropPath: data.bannerBackdropPath || null,
                photoURL: data.photoURL || null
            };
        }

        // Process Activity Data
        const activityPreview = activitySnap.docs.map(d => d.data());

        return {
            userInfo,
            diary: diary || [],
            watchlist: watchlist || [],
            likes: likes || [], // Raw IDs
            ratings: ratings || { episodes: [], seasons: [] },
            activityPreview: activityPreview || [],
            userPosters: (postersResult?.data || []).reduce((acc, row) => {
                if (row.series_id && row.poster_path) acc[row.series_id] = row.poster_path;
                return acc;
            }, {})
        };

    } catch (error) {
        console.error("Error in getUserProfileData:", error);
        throw error; // Let caller handle or return partial?
        // Returning partial could be safer for UI, but throw ensures we know something broke.
        // Given 'Stabilizes Profile rendering', maybe return partial if crucial parts succeed?
        // But if Promise.all fails, everything fails.
        // Return empty structure on error to prevent crash?
        return {
            userInfo: null,
            diary: [],
            watchlist: [],
            likes: [],
            ratings: { episodes: [], seasons: [] },
            activityPreview: []
        };
    }
};
