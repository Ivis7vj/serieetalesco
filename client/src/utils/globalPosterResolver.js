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
 * Resolve poster for a series or specific season
 * @param {number|string} seriesId - TMDB series ID
 * @param {string} defaultPosterPath - Default TMDB poster path from API
 * @param {object} userPosters - Map of posters (seriesId_seasonNumber -> path)
 * @param {number} seasonNumber - Specific season number (0 for series level)
 * @param {boolean} useSeriesFallback - Whether to fallback to series-level custom poster for season requests
 * @returns {string|null} - Poster path (without base URL)
 */
export const resolvePoster = (seriesId, defaultPosterPath, userPosters = {}, seasonNumber = 0, useSeriesFallback = true) => {
    // Ensure properly formatted season number (handle null/undefined)
    const safeSeasonNumber = (seasonNumber === null || seasonNumber === undefined) ? 0 : Number(seasonNumber);

    if (!userPosters) return defaultPosterPath || null;

    // Priority 1: User's custom poster for THIS specific season
    const seasonKey = `${seriesId}_${safeSeasonNumber}`;
    if (userPosters[seasonKey]) {
        return userPosters[seasonKey];
    }

    // Priority 2: Fallback to series-level custom poster (season 0) if it's a season request AND fallback enabled
    if (useSeriesFallback && safeSeasonNumber > 0) {
        const seriesKey = `${seriesId}_0`;
        if (userPosters[seriesKey]) {
            return userPosters[seriesKey];
        }
    }

    // Priority 3: Support legacy unqualified series ID keys (only for series-level or if fallback enabled)
    if ((safeSeasonNumber === 0 || useSeriesFallback) && userPosters[seriesId]) {
        return userPosters[seriesId];
    }

    // Priority 4: TMDB default (Specific season path or series path provided by caller)
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

    // Return absolute URLs as-is
    if (posterPath.startsWith('http')) return posterPath;

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
    size = 'w500',
    seasonNumber = 0,
    useSeriesFallback = true
) => {
    const resolvedPath = resolvePoster(seriesId, defaultPosterPath, userPosters, seasonNumber, useSeriesFallback);
    return getTMDBImageUrl(resolvedPath, size);
};
