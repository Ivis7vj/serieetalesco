/**
 * GLOBAL POSTER RESOLVER
 * 
 * Single source of truth for poster resolution across the entire app.
 * Priority:
 * 1. User's custom poster from Supabase (user_posters table)
 * 2. TMDB default poster
 * 
 * Returns: Poster path (without TMDB base URL) or null
 */

/**
 * Resolve poster for a series
 * @param {number|string} seriesId - TMDB series ID
 * @param {string} defaultPosterPath - Default TMDB poster path from API
 * @param {object} userPosters - Map of seriesId -> custom poster path (from context)
 * @returns {string|null} - Poster path (without base URL)
 */
export const resolvePoster = (seriesId, defaultPosterPath, userPosters = {}) => {
    // Priority 1: User's custom poster
    if (userPosters && userPosters[seriesId]) {
        return userPosters[seriesId];
    }

    // Priority 2: TMDB default
    return defaultPosterPath || null;
};

/**
 * Get full TMDB image URL for a poster path
 * @param {string} posterPath - Poster path (with or without leading slash)
 * @param {string} size - Image size (w500, w342, w780, original, etc.)
 * @returns {string|null} - Full TMDB URL or null
 */
export const getTMDBImageUrl = (posterPath, size = 'w500') => {
    if (!posterPath) return null;

    // Ensure path starts with /
    const path = posterPath.startsWith('/') ? posterPath : `/${posterPath}`;

    return `https://image.tmdb.org/t/p/${size}${path}`;
};

/**
 * Resolve and get full poster URL in one call
 * @param {number|string} seriesId - TMDB series ID
 * @param {string} defaultPosterPath - Default TMDB poster path
 * @param {object} userPosters - User's custom posters map
 * @param {string} size - Image size
 * @returns {string|null} - Full TMDB URL or placeholder
 */
export const getResolvedPosterUrl = (
    seriesId,
    defaultPosterPath,
    userPosters = {},
    size = 'w500'
) => {
    const resolvedPath = resolvePoster(seriesId, defaultPosterPath, userPosters);
    return getTMDBImageUrl(resolvedPath, size);
};
