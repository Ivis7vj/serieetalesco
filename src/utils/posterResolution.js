/**
 * Global Poster Resolution Utility
 * Resolves the correct poster path based on user selection coverage
 */

export const resolvePoster = (userData, seriesId, seasonNumber, fallbackPoster) => {
    // Priority 1: User-selected season poster (if user exists and has a selection)
    if (userData && seriesId && seasonNumber) {
        const seasonKey = `${seriesId}_${seasonNumber}`;
        if (userData.selectedPosters?.[seasonKey]) {
            return userData.selectedPosters[seasonKey];
        }
    }

    // Priority 2: TMDB Season Default (usually passed as fallbackPoster if it's a season object)
    // IMPORTANT: The caller is responsible for passing the correct fallback. 
    // If resolving for a season, 'fallbackPoster' should be that season's poster_path.
    // If resolving for a series main card, 'fallbackPoster' might be series.poster_path.
    if (fallbackPoster) return fallbackPoster;

    // Priority 3: Series Fallback (Not handled here explicitly as we return fallbackPoster, 
    // but the caller should usually provide the series poster as a last resort if season poster is missing)
    return null;
};

export const getSeasonPosterKey = (seriesId, seasonNumber) => {
    return `${seriesId}_${seasonNumber}`;
};
