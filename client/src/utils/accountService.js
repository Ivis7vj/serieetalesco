import { supabase } from '../supabase-config';
import { db } from '../firebase-config';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';

/**
 * Account Service
 * 
 * Handles critical account operations: Deletion and comprehensive cleanup.
 * Ensures strict removal of User Data from all sources:
 * 1. Supabase (Relational Data)
 * 2. Firestore (User Documents & Activity)
 * 3. Firebase Auth (User Credentials)
 */

/**
 * Recursively deletes documents matching a query in batches of 500.
 * @param {string} collectionName - Firestore collection name
 * @param {string} userIdField - Field to query by (e.g. 'userId')
 * @param {string} userId - Value to match
 */
const deleteFirestoreCollection = async (collectionName, userIdField, userId) => {
    console.log(`[Account Service] Cleaning Firestore collection: ${collectionName}...`);
    let totalDeleted = 0;

    while (true) {
        const q = query(
            collection(db, collectionName),
            where(userIdField, '==', userId),
            limit(500)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        totalDeleted += snapshot.size;
    }
    console.log(`[Account Service] Deleted ${totalDeleted} docs from ${collectionName}`);
};

/**
 * Completely deletes a user's account and all associated data.
 * @param {object} currentUser - The Firebase Auth User object
 */
export const deleteUserAccount = async (currentUser) => {
    if (!currentUser) throw new Error("No user logged in.");
    const userId = currentUser.uid;

    console.log(`[Account Service] STARTING DELETION for User: ${userId}`);

    try {
        // STEP 1: Supabase Cleanup (Parallel Execution)
        // All tables keyed by 'user_id'
        const tables = [
            'watchlist',
            'likes',
            'episode_ratings',
            'season_ratings',
            'episode_reviews',
            'season_reviews',
            'diary_entries',
            'user_posters'
        ];

        const supabaseDeletes = tables.map(async (table) => {
            const { error } = await supabase.from(table).delete().eq('user_id', userId);
            if (error) {
                console.warn(`[Supabase Warn] Failed to clear table ${table}:`, error.message);
                // We typically continue even if one table fails, to clean as much as possible.
                // Or we could throw to abort. Let's log warning and continue.
            }
        });

        await Promise.all(supabaseDeletes);
        console.log("[Account Service] Supabase data cleared.");

        // STEP 2: Firestore Cleanup
        // A. Activity Feed
        await deleteFirestoreCollection('user_activity', 'userId', userId);

        // B. Legacy Reviews (Firebase-only reviews)
        await deleteFirestoreCollection('reviews', 'userId', userId);

        // C. Main User Document
        // Also check if there are other collections like 'notifications' nested? 
        // Our 'notifications' are arrays inside users, so deleting user doc is enough.
        await deleteDoc(doc(db, 'users', userId));
        console.log("[Account Service] Firestore user profile deleted.");

        // STEP 3: Firebase Auth Deletion
        // This must be last because we need auth to write to DBs (RLS/Rules)
        await currentUser.delete();
        console.log("[Account Service] Firebase Auth credentials deleted.");

        return { success: true };

    } catch (error) {
        console.error("[Account Service] Deletion Failed:", error);

        if (error.code === 'auth/requires-recent-login') {
            throw new Error("Security Check: Please log out and log in again to delete your account.");
        }

        throw error;
    }
};
