import React from 'react';

const LoadingPopup = () => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.3s ease-in'
        }}>
            <div style={{
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
                <p style={{
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: '500',
                    margin: 0,
                    fontFamily: "'Inter', sans-serif"
                }}>
                    Preparing sticker...
                </p>
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
