import { useEffect, useCallback } from 'react';

/**
 * Hook to lock body scroll when a modal/popup is open.
 * Handles scroll position preservation and touchmove blocking for mobile.
 */
export const useScrollLock = (isLocked) => {
    useEffect(() => {
        if (isLocked) {
            document.body.classList.add('lock-scroll');
        } else {
            document.body.classList.remove('lock-scroll');
        }

        return () => {
            document.body.classList.remove('lock-scroll');
        };
    }, [isLocked]);
};
