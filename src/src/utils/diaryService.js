import { supabase } from '../supabase-config';
import { db } from '../firebase-config';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * 🎯 DIARY SYSTEM v2 (Strict Logic)
 * 
 * A Diary entry is ONLY created if:
 * 1. Season is WATCHED (marked globally or in payload)
 * 2. Season is RATED
 * 3. Season is REVIEWED (Text required)
 * 
 * Storage: 'diary_entries' table in Supabase.
 * Fields: user_id, tmdb_id, season_number, rating, review_text, poster_path, watched_at, created_at.
 */

// Schema Helper
const normalizeDiaryEntry = (entry) => ({
    id: entry.id,
    userId: entry.user_id,
    tmdbId: entry.tmdb_id,
    seriesName: entry.series_name,
    name: entry.series_name, // COMPATIBILITY FIX: Profile.jsx expects 'name'
    seasonNumber: entry.season_number,
    posterPath: entry.poster_path, // Custom or Season Poster
    rating: entry.rating,
    review: entry.review_text || "",
    date: entry.watched_at,
    createdAt: entry.created_at,
    // Helper booleans
    isSeason: true // Diary entries are always seasons in this new system
});

/**
 * ✅ CHECK CONDITIONS & CREATE DIARY ENTRY
 * This is the SINGLE point of entry for creating a diary item.
 */
export const createDiaryEntry = async (userId, seriesData, seasonNumber, reviewData, watchedDate = new Date().toISOString()) => {
    // 1. Validate Inputs
    if (!reviewData.rating || !reviewData.review) {
        return { success: false, error: "Review and Rating are required for Diary." };
    }

    // 2. Prepare Payload
    const payload = {
        user_id: userId,
        tmdb_id: seriesData.id,
        series_name: seriesData.name,
        season_number: Number(seasonNumber),
        poster_path: reviewData.posterPath || seriesData.poster_path, // Allow custom poster passed in reviewData
        rating: reviewData.rating,
        review_text: reviewData.review,
        watched_at: watchedDate,
        entry_type: 'SEASON_DIARY_v2' // Distinct type for v2 strict entries
    };

    try {
        // Assuming unique constraint: user_id, tmdb_id, season_number
        console.log("📤 Sending payload to Supabase:", payload);
        const { data, error } = await supabase
            .from('diary_entries')
            .upsert(payload, { onConflict: 'user_id,tmdb_id,season_number' }) // Strict uniqueness per season
            .select()
            .single();

        if (error) throw error;

        return { success: true, data: normalizeDiaryEntry(data) };

    } catch (error) {
        console.error("Diary Creation Failed:", error);
        return { success: false, error };
    }
};

/**
 * ✏️ UPDATE DIARY ENTRY
 */
export const updateDiaryEntry = async (entryId, updates) => {
    const payload = {};
    if (updates.rating) payload.rating = updates.rating;
    if (updates.review) payload.review_text = updates.review;
    if (updates.date) payload.watched_at = updates.date;

    // Auto-update 'updated_at' handled by DB or ignored

    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .update(payload)
            .eq('id', entryId)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: normalizeDiaryEntry(data) };
    } catch (e) {
        return { success: false, error: e };
    }
};

/**
 * 🗑 DELETE DIARY ENTRY
 * Completely removes the entry.
 */
export const deleteDiaryEntry = async (entryId) => {
    try {
        const { error } = await supabase
            .from('diary_entries')
            .delete()
            .eq('id', entryId);

        if (error) throw error;
        return { success: true };
    } catch (e) {
        return { success: false, error: e };
    }
};

/**
 * 📖 GET USER DIARY
 * Strictly filters for valid entries (Rated + Reviewed).
 */
export const getUserDiary = async (userId) => {
    try {
        console.log(`🔍 Fetching diary for user: ${userId}`);
        const { data, error } = await supabase
            .from('diary_entries')
            .select('*')
            .eq('user_id', userId)
            .order('watched_at', { ascending: false });

        if (error) {
            console.error("❌ SUPABASE DIARY FETCH ERROR:", error);
            throw error;
        }
        console.log(`✅ Found ${data?.length || 0} diary entries.`);

        // 2. Strict Filter (Client Side Safety Net)
        // Only allow entries with Rating AND Review
        // Also legacy 'SEASON_DIARY_v2' implies correctness, but legacy data might exist.
        // "remove the posters user having from the diary section... if not done remove"
        const validEntries = (data || []).map(normalizeDiaryEntry).filter(item => {
            // Rule: Must be a Season
            if (!item.seasonNumber && item.seasonNumber !== 0) return false;
            // Rule: Must have Rating
            if (!item.rating) return false;
            // Rule: Must have Review Text (Strict v2)
            // Note: If user wants to enforce this on OLD data, this line does it.
            if (!item.review || item.review.trim() === "") return false;

            return true;
        });

        return validEntries;

    } catch (error) {
        console.error("Error fetching diary:", error);
        return [];
    }
};

/**
 * 🔍 GET SINGLE DIARY ENTRY BY ID (For Detail Page)
 */
export const getDiaryEntryById = async (entryId) => {
    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .select('*')
            .eq('id', entryId)
            .single();

        if (error) throw error;
        return normalizeDiaryEntry(data);
    } catch (e) {
        console.error("Error fetching diary entry:", e);
        return null;
    }
};

/**
 * 🔍 GET SINGLE DIARY ENTRY (For Series Details Status)
 */
export const getSeasonDiaryEntry = async (userId, tmdbId, seasonNumber) => {
    try {
        const { data, error } = await supabase
            .from('diary_entries')
            .select('*')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId)
            .eq('season_number', seasonNumber)
            .maybeSingle(); // Returns null if not found

        if (error) throw error;
        if (!data) return null;

        // Normalize and strict check
        const entry = normalizeDiaryEntry(data);
        if (!entry.rating || !entry.review) return null; // Treat partial as non-existent

        return entry;
    } catch (e) {
        return null;
    }
};

