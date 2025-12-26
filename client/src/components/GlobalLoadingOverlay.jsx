import React from 'react';
import { useLoading } from '../context/LoadingContext';
import PremiumLoader from './PremiumLoader';

const GlobalLoadingOverlay = () => {
    const { isLoading, loadingMessage } = useLoading();

    React.useEffect(() => {
        if (isLoading) {
            document.body.classList.add('loading');
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        } else {
            document.body.classList.remove('loading');
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }
        return () => {
            document.body.classList.remove('loading');
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [isLoading]);

    if (!isLoading) return null;

    return <PremiumLoader message={loadingMessage} />;
};

export default GlobalLoadingOverlay;
