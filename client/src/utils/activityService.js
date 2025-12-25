import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';

export const activityService = {
    /**
     * Checks if there is any new activity since the last viewed time.
     * @param {Object} userData - Current user data (must include .following)
     * @returns {Promise<boolean>}
     */
    hasNewActivity: async (userData) => {
        if (!userData || !userData.following || userData.following.length === 0) return false;

        try {
            const lastViewed = localStorage.getItem('last_viewed_friends_activity');
            const lastViewedTime = lastViewed ? parseInt(lastViewed) : 0;

            // Limit to 10 for 'in' query limitation
            const followingSlice = userData.following.slice(0, 10);

            const q = query(
                collection(db, 'user_activity'),
                where('userId', 'in', followingSlice),
                orderBy('createdAt', 'desc'),
                limit(1)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return false;

            const latestActivity = snapshot.docs[0].data();
            const latestTime = new Date(latestActivity.createdAt).getTime();

            return latestTime > lastViewedTime;
        } catch (error) {
            console.error("Activity check failed:", error);
            return false;
        }
    },

    /**
     * Marks activity as viewed by updating the local timestamp.
     */
    markActivityViewed: () => {
        localStorage.setItem('last_viewed_friends_activity', Date.now().toString());
        // Dispatch custom event to notify Sidebar or other components
        window.dispatchEvent(new CustomEvent('friends-activity-viewed'));
    }
};
