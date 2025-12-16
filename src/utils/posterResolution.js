/**
 * Global Poster Resolution Utility
 * Resolves the correct poster path based on user selection coverage
 */

export const resolvePoster = (userData, seriesId, seasonNumber, fallbackPoster) => {
    if (!userData || !seriesId) return fallbackPoster;

    // 1. Check for specific season selection
    // Structure: selectedPosters: { "seriesId_seasonNumber": "path" }
    if (seasonNumber) {
        const seasonKey = `${seriesId}_${seasonNumber}`;
        if (userData.selectedPosters?.[seasonKey]) {
            return userData.selectedPosters[seasonKey];
        }
    }

    // 2. Fallback to provided poster (usually TMDB default)
    return fallbackPoster;
};
