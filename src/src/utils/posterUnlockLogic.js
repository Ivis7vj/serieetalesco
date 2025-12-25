/**
 * Poster Unlock Logic Utilities
 * Determines how many posters should be unlocked based on series completion status
 */

export const getPosterUnlockStatus = (totalSeasons, completedCount, totalPosters) => {
    if (totalSeasons <= 0 || totalPosters <= 0) {
        return { unlockCount: 0, isFullSeriesUnlocked: false };
    }

    // If all seasons completed, unlock everything
    if (completedCount >= totalSeasons) {
        return { unlockCount: totalPosters, isFullSeriesUnlocked: true };
    }

    // Formula: floor((completedCount / totalSeasons) * totalPosters)
    // Ensure at least 1 poster is unlocked if at least one season is completed
    let unlockCount = Math.floor((completedCount / totalSeasons) * totalPosters);
    if (completedCount > 0) {
        unlockCount = Math.max(1, unlockCount);
    }

    return {
        unlockCount,
        isFullSeriesUnlocked: completedCount >= totalSeasons
    };
};
