import React, { useState, useEffect } from 'react';

const PremiumLoader = ({ message }) => {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // Delay the appearance of the loader by 200ms
        // This prevents the "flash" of the loader for fast cache hits
        const timer = setTimeout(() => {
            setShouldRender(true);
        }, 200);

        return () => clearTimeout(timer);
    }, []);

    if (!shouldRender) return null;

    return (
        <div className="minimal-spinner-overlay">
            <style>
                {`
                .minimal-spinner-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #000;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    gap: 20px;
                }

                .netflix-circle {
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(255, 214, 0, 0.2);
                    border-top: 4px solid #FFD600;
                    border-radius: 50%;
                    animation: spinCircle 1s linear infinite;
                }

                .loader-message {
                    color: #fff;
                    font-size: 1.1rem;
                    font-weight: 500;
                    font-family: 'Inter', sans-serif;
                    letter-spacing: 0.5px;
                }

                @keyframes spinCircle {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                `}
            </style>

            <div className="netflix-circle"></div>
            {message && <div className="loader-message">{message}</div>}
        </div>
    );
};

export default PremiumLoader;
