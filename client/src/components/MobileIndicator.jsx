import React, { useEffect, useState } from 'react';
import { useOnboarding } from '../context/OnboardingContext';
import './MobileIndicator.css'; // We'll create this

const MobileIndicator = ({ id, message, targetRef, position = 'bottom', style = {}, duration = 5000 }) => {
    const { activeIndicatorId, requestShow, dismiss } = useOnboarding();
    const [isVisible, setIsVisible] = useState(false);

    // Try to show on mount
    useEffect(() => {
        requestShow(id);
    }, [id, requestShow]);

    // Sync visibility with context
    useEffect(() => {
        if (activeIndicatorId === id) {
            setIsVisible(true);

            // Auto dismiss timer
            const timer = setTimeout(() => {
                dismiss(id);
            }, duration);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [activeIndicatorId, id, dismiss, duration]);

    // Update coordinates if targetRef is provided
    useEffect(() => {
        if (isVisible && targetRef?.current) {
            const rect = targetRef.current.getBoundingClientRect();
            // We want fixed positioning relative to viewport since it's "floating" over everything
            // Actually usually simplest is absolute relative to parent if parent is relative.
            // But strict requirement: "Floating... not popups".
            // Let's use relative to parent for simplicity if the parent is the button wrapper.
            // If targetRef not passed, assume parent is relative.

            // However, for precise control (like "below button"), simple CSS is often best if component is IN the JSX.
            // If component is fully separate, we need coords.
            // Let's assume component is placed INSIDE the button container for standard usage.
        }
    }, [isVisible, targetRef]);

    if (!isVisible) return null;

    // Default class based on position prop
    const positionClass = `mobile-indicator-${position}`;

    return (
        <div
            className={`mobile-indicator ${positionClass}`}
            style={style}
        >
            {message}
        </div>
    );
};

export default MobileIndicator;
