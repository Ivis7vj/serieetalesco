import React from 'react';
import { useScrollLock } from '../hooks/useScrollLock';

const LoadingPopup = ({ message = "Loading..." }) => {
    useScrollLock(true);
    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{
                background: '#000',
                padding: '60px 80px',
                borderRadius: '16px',
                border: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '30px'
            }}>
                {/* Spinner */}
                <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid #333',
                    borderTop: '4px solid #fff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />

                {/* Text */}
                {message && (
                    <p style={{
                        color: '#fff',
                        fontSize: '18px',
                        fontWeight: '500',
                        margin: 0,
                        fontFamily: "'Inter', sans-serif"
                    }}>
                        {message}
                    </p>
                )}
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LoadingPopup;
