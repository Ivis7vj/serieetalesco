import { supabase } from '../supabase-config';
import { db } from '../firebase-config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * watchedService.js
 * 
 * Handles all watched status logic with STRICT migration rules.
 * Source of Truth: Supabase (watched_episodes table).
 * 
 * CORE RULES:
 * 1. Writes: ALWAYS to Supabase ONLY. NEVER write to Firebase.
 * 2. Reads: 
 *    - IF watched_series_migrations contains (user_id, tmdb_id) → READ from Supabase ONLY
 *    - ELSE → READ from Firebase ONLY (legacy bootstrap)
 * 3. Soft Migration: On first watch/unwatch action, bulk-copy Firebase → Supabase, then lock.
 * 4. Migration Lock: Once migrated, Firebase is IGNORED forever for that series.
 */

// ============================================
// HELPER FUNCTIONS (Internal)
// ============================================

/**
 * Check if a series has been migrated for a user.
 * @returns {Promise<boolean>} true if migrated, false otherwise
 */
const checkMigrationStatus = async (userId, tmdbId) => {
    try {
        const { data, error } = await supabase
            .from('watched_series_migrations')
            .select('migrated_at')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .maybeSingle();

        if (error) throw error;
        return !!data; // true if row exists
    } catch (error) {
        console.error("Error checking migration status:", error);
        return false;
    }
};

/**
 * Perform one-time soft migration from Firebase to Supabase.
 * IDEMPOTENT: Rechecks migration status to prevent duplicate inserts.
 * 
 * @returns {Promise<void>}
 */
const performSoftMigration = async (userId, tmdbId) => {
    try {
        // 🔒 IDEMPOTENCY CHECK (Phase 2.3 refinement)
        // Recheck migration status inside function to handle race conditions
        const alreadyMigrated = await checkMigrationStatus(userId, tmdbId);
        if (alreadyMigrated) {
            console.log(`Series ${tmdbId} already migrated for user ${userId}. Skipping.`);
            return; // Exit early - migration already complete
        }

        console.log(`Starting soft migration for series ${tmdbId}, user ${userId}`);

        // 1. Fetch legacy watched episodes from Firebase
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        const episodesToMigrate = [];

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const watchedArray = userData.watched || [];
            const prefix = `${tmdbId}-S`;

            // Parse Firebase watched array for THIS series only
            const seriesWatched = watchedArray
                .filter(item => {
                    const idStr = String(typeof item === 'string' ? item : (item.id || ''));
                    return idStr.startsWith(prefix);
                })
                .map(item => {
                    const idStr = String(typeof item === 'string' ? item : (item.id || ''));
                    // Parse format: "12345-S1-E2"
                    const parts = idStr.split('-');
                    if (parts.length >= 3) {
                        const seasonNum = parseInt(parts[1].substring(1)); // Remove 'S'
                        const episodeNum = parseInt(parts[2].substring(1)); // Remove 'E'

                        if (!isNaN(seasonNum) && !isNaN(episodeNum)) {
                            return {
                                user_id: userId,
                                tmdb_id: tmdbId,
                                season_number: seasonNum,
                                episode_number: episodeNum,
                                watched_at: new Date().toISOString()
                            };
                        }
                    }
                    return null;
                })
                .filter(item => item !== null);

            episodesToMigrate.push(...seriesWatched);
        }

        // 2. Bulk insert into Supabase (if any legacy data exists)
        if (episodesToMigrate.length > 0) {
            console.log(`Migrating ${episodesToMigrate.length} episodes to Supabase`);
            const { error: insertError } = await supabase
                .from('watched_episodes')
                .upsert(episodesToMigrate, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

            if (insertError) throw insertError;
        } else {
            console.log(`No legacy data found for series ${tmdbId}`);
        }

        // 3. Mark series as migrated (CREATE MIGRATION LOCK)
        const { error: migrationError } = await supabase
            .from('watched_series_migrations')
            .insert({
                user_id: userId,
                tmdb_id: tmdbId,
                migrated_at: new Date().toISOString()
            });

        if (migrationError) {
            // Handle duplicate key error gracefully (race condition)
            if (migrationError.code === '23505') { // PostgreSQL unique violation
                console.log('Migration row already exists (race condition). Safe to proceed.');
            } else {
                throw migrationError;
            }
        }

        console.log(`✅ Migration complete for series ${tmdbId}`);
    } catch (error) {
        console.error("Error during soft migration:", error);
        throw error; // Re-throw to let caller handle
    }
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Get all watched episodes for a series.
 * STRICT LOGIC: Check migration status FIRST, then read from appropriate source.
 * 
 * @param {string} userId - Firebase UID
 * @param {number} tmdbId - Series TMDB ID
 * @returns {Promise<Array<{season: number, episode: number}>>}
 */
export const getWatchedEpisodes = async (userId, tmdbId) => {
    if (!userId || !tmdbId) return [];

    try {
        // 🔒 STRICT READ LOGIC
        const isMigrated = await checkMigrationStatus(userId, tmdbId);

        if (isMigrated) {
            // ✅ MIGRATED: Read from Supabase ONLY
            const { data, error } = await supabase
                .from('watched_episodes')
                .select('season_number, episode_number')
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId);

            if (error) throw error;

            return data.map(item => ({
                season: item.season_number,
                episode: item.episode_number
            }));
        } else {
            // ❌ NOT MIGRATED: Read from Firebase ONLY (legacy)
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const watchedArray = userData.watched || [];
                const prefix = `${tmdbId}-S`;

                const seriesWatched = watchedArray.filter(item => {
                    const idStr = String(typeof item === 'string' ? item : (item.id || ''));
                    return idStr.startsWith(prefix);
                });

                return seriesWatched.map(item => {
                    const idStr = String(typeof item === 'string' ? item : (item.id || ''));
                    const parts = idStr.split('-');
                    if (parts.length >= 3) {
                        const s = parseInt(parts[1].substring(1));
                        const e = parseInt(parts[2].substring(1));
                        return { season: s, episode: e };
                    }
                    return null;
                }).filter(item => item !== null);
            }

            return [];
        }
    } catch (error) {
        console.error("Error fetching watched episodes:", error);
        return [];
    }
};

/**
 * Mark a single episode as watched.
 * Triggers soft migration on first interaction.
 * 
 * ⚠️ WRITES TO SUPABASE ONLY. NEVER WRITES TO FIREBASE.
 */
export const markEpisodeWatched = async (userId, tmdbId, seasonNumber, episodeNumber) => {
    if (!userId || !tmdbId) return false;

    try {
        // Trigger migration if needed (idempotent)
        const isMigrated = await checkMigrationStatus(userId, tmdbId);
        if (!isMigrated) {
            await performSoftMigration(userId, tmdbId);
        }

        // Insert/update the watched episode in Supabase
        const { error } = await supabase
            .from('watched_episodes')
            .upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                season_number: seasonNumber,
                episode_number: episodeNumber,
                watched_at: new Date().toISOString()
            }, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error marking episode watched:", error);
        return false;
    }
};

/**
 * Unmark a single episode as watched (remove from watched list).
 * Triggers soft migration on first interaction.
 * 
 * ⚠️ WRITES TO SUPABASE ONLY. NEVER WRITES TO FIREBASE.
 */
export const unmarkEpisodeWatched = async (userId, tmdbId, seasonNumber, episodeNumber) => {
    if (!userId || !tmdbId) return false;

    try {
        // Trigger migration if needed (idempotent)
        const isMigrated = await checkMigrationStatus(userId, tmdbId);
        if (!isMigrated) {
            await performSoftMigration(userId, tmdbId);
        }

        // Delete the episode from Supabase
        const { error } = await supabase
            .from('watched_episodes')
            .delete()
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error unmarking episode watched:", error);
        return false;
    }
};

/**
 * Mark all episodes in a season as watched.
 * Triggers soft migration on first interaction.
 * 
 * @param {string} userId 
 * @param {number} tmdbId 
 * @param {number} seasonNumber 
 * @param {number} totalEpisodes - Total number of episodes in the season
 * @returns {Promise<boolean>}
 */
export const markSeasonWatched = async (userId, tmdbId, seasonNumber, totalEpisodes) => {
    if (!userId || !tmdbId || !totalEpisodes) return false;

    try {
        // Trigger migration if needed (idempotent)
        const isMigrated = await checkMigrationStatus(userId, tmdbId);
        if (!isMigrated) {
            await performSoftMigration(userId, tmdbId);
        }

        // Create array of all episodes in the season
        const episodes = Array.from({ length: totalEpisodes }, (_, i) => ({
            user_id: userId,
            tmdb_id: tmdbId,
            season_number: seasonNumber,
            episode_number: i + 1,
            watched_at: new Date().toISOString()
        }));

        // Bulk upsert all episodes
        const { error } = await supabase
            .from('watched_episodes')
            .upsert(episodes, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error marking season watched:", error);
        return false;
    }
};

/**
 * Check if a season is fully completed (all episodes watched).
 * Used for determining season completion state (NOT for storing).
 * 
 * @param {string} userId 
 * @param {number} tmdbId 
 * @param {number} seasonNumber 
 * @param {number} totalEpisodes 
 * @returns {Promise<boolean>}
 */
export const isSeasonCompleted = async (userId, tmdbId, seasonNumber, totalEpisodes) => {
    if (!userId || !tmdbId) return false;

    try {
        const { data, error } = await supabase
            .from('watched_episodes')
            .select('episode_number')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber);

        if (error) throw error;

        // Season is complete if watched count equals total episodes
        return data.length === totalEpisodes;
    } catch (error) {
        console.error("Error checking season completion:", error);
        return false;
    }
};
