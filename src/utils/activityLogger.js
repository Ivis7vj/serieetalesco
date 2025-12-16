import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase-config';

/**
 * Logs a user activity to the 'activities' collection.
 * 
 * @param {object} user - { uid, username, photoURL }
 * @param {string} actionType - 'liked', 'watchlist', 'reviewed', 'watched'
 * @param {object} seriesData - { id, name, poster_path, seasonNumber (optional) }
 */
export const logActivity = async (user, actionType, seriesData) => {
    if (!user || !user.uid) return;

    try {
        const activityData = {
            userId: user.uid,
            username: user.username || 'User',
            userProfilePicURL: user.photoURL || null,
            actionType: actionType, // 'liked', 'watched', 'watchlist', 'review', 'selected_poster'
            seriesId: seriesData.id,
            seriesName: seriesData.name,
            seriesPosterURL: seriesData.poster_path,
            seasonNumber: seriesData.seasonNumber || null,
            episodeNumber: seriesData.episodeNumber || null,
            rating: seriesData.rating || null,
            reviewSnippet: seriesData.review || null,
            timestamp: serverTimestamp(), // Server time
            createdAt: Date.now() // Client time for easy filtering if needed
        };

        await addDoc(collection(db, 'activities'), activityData);
        // Fire & Forget - no await needed technically if we don't block UI
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
};
