import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const AnimationContext = createContext();

export const AnimationProvider = ({ children }) => {
    const location = useLocation();
    const navType = useNavigationType(); // POP, PUSH, REPLACE
    const [direction, setDirection] = useState('none');

    // Define Footer Order for specific slide logic
    const footerOrder = ['/', '/series-graph', '/reviews', '/profile', '/friends'];

    useEffect(() => {
        // We can optimize this if needed, but simple "forward/back" is hard to know without history stack
        // For footer items, we can use their index
        if (navType === 'POP') {
            setDirection('right'); // Back
        } else {
            setDirection('left'); // Forward by default
        }

        // Footer Logic Override
        const prevPath = window.sessionStorage.getItem('prevPath');
        const currPath = location.pathname;

        const prevIndex = footerOrder.indexOf(prevPath);
        const currIndex = footerOrder.indexOf(currPath);

        if (prevIndex !== -1 && currIndex !== -1) {
            if (currIndex > prevIndex) setDirection('right'); // User Requested: "Swipe Right" (Enter from Left)
            else if (currIndex < prevIndex) setDirection('left'); // "Swipe Left" (Enter from Right)
        }

        window.sessionStorage.setItem('prevPath', currPath);

    }, [location.pathname, navType]);

    return (
        <AnimationContext.Provider value={{ direction }}>
            {children}
        </AnimationContext.Provider>
    );
};

export const useAnimation = () => useContext(AnimationContext);
