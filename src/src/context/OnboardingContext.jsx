import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const OnboardingContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useOnboarding = () => useContext(OnboardingContext);

export const OnboardingProvider = ({ children }) => {
    // Current active indicator ID (only one at a time)
    const [activeIndicatorId, setActiveIndicatorId] = useState(null);

    // Track seen indicators to prevent repetition
    const [seenIds, setSeenIds] = useState(() => {
        try {
            const stored = localStorage.getItem('seen_mobile_indicators');
            if (stored) return new Set(JSON.parse(stored));
            return new Set();
        } catch {
            return new Set();
        }
    });

    // Helper to check if mobile
    const isMobile = () => window.innerWidth <= 768;

    const markSeen = useCallback((id) => {
        setSeenIds(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            localStorage.setItem('seen_mobile_indicators', JSON.stringify([...next]));
            return next;
        });
    }, []);

    const requestShow = useCallback((id) => {
        // Strict Rules:
        // 1. Must be mobile
        // 2. Must not be already seen
        // 3. Must not have another indicator active (First Come, First Served per session interaction)

        if (!isMobile()) return;

        // Skip 'seen' check for poster tip during verification
        const isPosterTip = id?.includes('edit-poster-tip');
        if (!isPosterTip && (seenIds.has(id) || seenIds.has('ALL_DISABLED'))) return;

        setActiveIndicatorId(current => {
            if (current) return current; // Block if something else is showing
            return id;
        });
    }, [seenIds]);

    const dismiss = useCallback((id) => {
        setActiveIndicatorId(current => {
            if (current === id) return null;
            return current;
        });
        if (id) markSeen(id);
    }, [markSeen]);

    // Global Interaction Listener to dismiss ANY active indicator
    useEffect(() => {
        if (!activeIndicatorId) return;

        const handleInteraction = () => {
            dismiss(activeIndicatorId);
        };

        window.addEventListener('touchstart', handleInteraction, { passive: true });
        window.addEventListener('scroll', handleInteraction, { passive: true });
        window.addEventListener('click', handleInteraction, { passive: true });

        return () => {
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('scroll', handleInteraction);
            window.removeEventListener('click', handleInteraction);
        };
    }, [activeIndicatorId, dismiss]);

    return (
        <OnboardingContext.Provider value={{ activeIndicatorId, requestShow, dismiss }}>
            {children}
        </OnboardingContext.Provider>
    );
};
