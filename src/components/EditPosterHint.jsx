import { useState, useEffect } from 'react';
import './EditPosterHint.css';

const EditPosterHint = ({ show, onComplete }) => {
    const [visible, setVisible] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        if (show) {
            // Show hint immediately
            setVisible(true);

            // Start fade-out after 4.5 seconds
            const fadeTimer = setTimeout(() => {
                setFadeOut(true);
            }, 4500);

            // Hide completely after 5 seconds
            const hideTimer = setTimeout(() => {
                setVisible(false);
                setFadeOut(false);
                if (onComplete) onComplete();
            }, 5000);

            return () => {
                clearTimeout(fadeTimer);
                clearTimeout(hideTimer);
            };
        }
    }, [show, onComplete]);

    if (!visible) return null;

    return (
        <div className={`edit-poster-hint ${fadeOut ? 'fade-out' : ''}`}>
            <div className="hint-arrow">↑</div>
            <div className="hint-text">You are eligible to edit the poster</div>
        </div>
    );
};

export default EditPosterHint;
