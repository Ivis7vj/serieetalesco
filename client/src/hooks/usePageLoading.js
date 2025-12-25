import { useEffect } from 'react';
import { useLoading } from '../context/LoadingContext';

/**
 * Hook to handle page-level loading state.
 * Automatically stops the loader when the component unmounts or when manual signal is given.
 */
export const usePageLoading = (autoStop = false) => {
    const { startLoading, stopLoading, isLoading } = useLoading();

    useEffect(() => {
        if (autoStop) {
            // If autoStop is true, we assume the page is "ready" on mount
            // This might be useful for static pages or pages that fetch very quickly
            stopLoading();
        }

        return () => {
            // Safety: Ensure loader is hidden when navigating away if it was still active
            stopLoading();
        };
    }, [autoStop, stopLoading]);

    return { startLoading, stopLoading, isLoading };
};
