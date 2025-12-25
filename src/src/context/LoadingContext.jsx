import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(null);

    const startLoading = useCallback((message = null) => {
        setIsLoading(true);
        setLoadingMessage(message);
    }, []);

    const stopLoading = useCallback(() => {
        setIsLoading(false);
        setLoadingMessage(null);
    }, []);

    return (
        <LoadingContext.Provider value={{ isLoading, loadingMessage, startLoading, stopLoading, setIsLoading }}>
            {children}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};
