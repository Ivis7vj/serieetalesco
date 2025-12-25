import { useEffect, useCallback } from 'react';

/**
 * Hook to lock body scroll when a modal/popup is open.
 * Handles scroll position preservation and touchmove blocking for mobile.
 */
export const useScrollLock = (isLocked) => {
    useEffect(() => {
        const root = document.querySelector('.app-root');
        if (!root) return;

        if (isLocked) {
            root.classList.add('no-scroll');
        } else {
            root.classList.remove('no-scroll');
        }

        return () => {
            root.classList.remove('no-scroll');
        };
    }, [isLocked]);
};
