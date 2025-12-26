import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // Target the actual scroll container defined in Layout/App
        const scroller = document.querySelector('.main-content') || document.querySelector('.app-root');
        if (scroller) {
            scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } else {
            window.scrollTo(0, 0);
        }
    }, [pathname]);

    return null;
};

export default ScrollToTop;
