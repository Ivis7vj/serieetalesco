import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db } from '../firebase-config';

/**
 * Logs a user activity to the 'user_activity' collection with strict retention and deduplication rules.
 * 
 * @param {object} user - { uid, username, photoURL }
 * @param {string} type - 'watched_episode', 'completed_season', 'poster_updated', 'rated_season'
 * @param {object} data - { seriesId, seriesName, posterPath, seasonNumber, episodeNumber, rating }
 */
export const logActivity = async (user, type, data) => {
    if (!user || !user.uid) return;

    const collectionRef = collection(db, 'user_activity');
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    try {
        // --- DEDUPLICATION RULES ---
        const dedupBatch = writeBatch(db);
        let commitDedup = false;

        // Rule 1: Subscription/Replacement
        // If poster updated -> remove previous 'poster_updated' for this series
        // If rated season -> remove previous 'rated_season' for this series+season
        if (type === 'poster_updated') {
            const q = query(collectionRef,
                where('userId', '==', user.uid),
                where('type', '==', 'poster_updated'),
                where('tmdbId', '==', data.seriesId)
            );
            const snaps = await getDocs(q);
            snaps.forEach(doc => { dedupBatch.delete(doc.ref); commitDedup = true; });
        }
        else if (type === 'rated_season') {
            const q = query(collectionRef,
                where('userId', '==', user.uid),
                where('type', '==', 'rated_season'),
                where('tmdbId', '==', data.seriesId),
                where('seasonNumber', '==', data.seasonNumber)
            );
            const snaps = await getDocs(q);
            snaps.forEach(doc => { dedupBatch.delete(doc.ref); commitDedup = true; });
        }
        // Rule 2: Consolidation
        // If season completed -> remove 'watched_episode' for same season from TODAY
        // Rule 2: Consolidation (Smart Season Logging)
        // If 'completed_season' (Season Watch) -> DELETE all 'watched_episode' logs for this season (Cleanup)
        // This prevents DB bloat and UI noise.
        else if (type === 'completed_season' || type === 'watched_season') {
            const q = query(collectionRef,
                where('userId', '==', user.uid),
                where('type', '==', 'watched_episode'),
                where('tmdbId', '==', Number(data.seriesId)), // Ensure Number type
                where('seasonNumber', '==', Number(data.seasonNumber))
            );
            const snaps = await getDocs(q);
            snaps.forEach(doc => {
                dedupBatch.delete(doc.ref);
                commitDedup = true;
            });
        }

        if (commitDedup) {
            await dedupBatch.commit();
        }

        // --- INSERT NEW ACTIVITY ---
        const activityDoc = {
            userId: user.uid,
            username: user.username || 'User', // For Friends Feed performance
            userProfilePicURL: user.photoURL || null,
            type: type, // 'watched_episode', 'completed_season', etc.

            // 🧠 NORMALIZE ACTIVITY TYPES (For UI Renderer)
            // 'WATCHED': No poster, text only
            // 'REVIEWED': Poster required, review card
            // 'WATCHLIST_ADDED': No poster, text only
            category: (type === 'watched_episode' || type === 'completed_season' || type === 'watched_season' || type === 'poster_updated') ? 'WATCHED'
                : (type === 'rated_season') ? 'REVIEWED'
                    : (type === 'watchlist_add') ? 'WATCHLIST_ADDED'
                        : 'WATCHED', // Fallback

            tmdbId: Number(data.seriesId),
            seriesName: data.seriesName || data.name,
            seasonNumber: data.seasonNumber ? Number(data.seasonNumber) : null,
            episodeNumber: data.episodeNumber ? Number(data.episodeNumber) : null,
            rating: data.rating || null,
            review: data.review || null, // Capture review text if present
            posterPath: data.posterPath || null, // Global poster or relevant image
            customText: data.customText || null,
            createdAt: now.toISOString(),
            serverTimestamp: serverTimestamp()
        };

        await addDoc(collectionRef, activityDoc);

        // --- RETENTION POLICY (Lazy Cleanup) ---
        // Clean up OLD logs based on strict retention rules
        // Episode watched -> 7 days
        // Season watched -> 30 days
        // Series watched -> 90 days (if implemented)
        const cleanupBatch = writeBatch(db);
        let hasCleanup = false;

        const cleanupQ = query(collectionRef,
            where('userId', '==', user.uid),
            // orderBy('createdAt', 'asc'), // Removed to prevent "Index Required" error
            limit(10) // Small batch
        );
        const oldSnaps = await getDocs(cleanupQ);

        const nowMs = now.getTime();
        const dayMs = 24 * 60 * 60 * 1000;

        oldSnaps.forEach(doc => {
            const data = doc.data();
            const docTime = data.createdAt ? new Date(data.createdAt).getTime() : 0;
            const ageDays = (nowMs - docTime) / dayMs;

            let shouldDelete = false;
            if (data.type === 'watched_episode' && ageDays > 7) shouldDelete = true;
            else if ((data.type === 'watched_season' || data.type === 'completed_season') && ageDays > 30) shouldDelete = true;
            else if (data.type === 'watched_series' && ageDays > 90) shouldDelete = true;
            else if (ageDays > 60) shouldDelete = true; // General fallback

            if (shouldDelete) {
                cleanupBatch.delete(doc.ref);
                hasCleanup = true;
            }
        });

        if (hasCleanup) {
            await cleanupBatch.commit();
        }

    } catch (error) {
        console.error("Activity Logging Error:", error);
    }
};
