import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const PremiumLoader = ({ message }) => {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // Delay the appearance of the loader by 200ms
        const timer = setTimeout(() => {
            setShouldRender(true);
        }, 200);

        return () => clearTimeout(timer);
    }, []);

    // Lock Scroll when active
    useEffect(() => {
        if (shouldRender) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [shouldRender]);

    if (!shouldRender) return null;

    return ReactDOM.createPortal(
        <div className="minimal-spinner-overlay">
            <style>
                {`
                .minimal-spinner-overlay {
                    position: fixed;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    left: 0;
                    width: 100% !important;
                    height: 100% !important;
                    background: #000;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999999;
                    gap: 20px;
                    pointer-events: all;
                    touch-action: none;
                }

                .netflix-circle {
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(255, 214, 0, 0.1);
                    border-top: 4px solid #FFD600;
                    border-radius: 50%;
                    animation: spinCircle 0.8s linear infinite;
                }

                .loader-message {
                    color: #fff;
                    font-family: 'Netflix Sans', sans-serif;
                    font-size: 14px;
                    letter-spacing: 0.5px;
                    opacity: 0.8;
                }

                @keyframes spinCircle {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}
            </style>
            <div className="netflix-circle"></div>
            {message && <div className="loader-message">{message}</div>}
        </div>,
        document.body
    );
};

export default PremiumLoader;
