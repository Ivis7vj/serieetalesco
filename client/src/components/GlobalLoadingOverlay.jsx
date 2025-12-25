import React from 'react';
import { useLoading } from '../context/LoadingContext';
import PremiumLoader from './PremiumLoader';

const GlobalLoadingOverlay = () => {
    const { isLoading, loadingMessage } = useLoading();

    React.useEffect(() => {
        if (isLoading) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isLoading]);

    if (!isLoading) return null;

    return <PremiumLoader message={loadingMessage} />;
};

export default GlobalLoadingOverlay;
