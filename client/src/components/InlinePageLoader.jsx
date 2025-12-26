import React from 'react';

const InlinePageLoader = ({ message = "Loading..." }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            minHeight: '60vh', // Ensure it takes up vertical space
            background: 'var(--bg-primary)',
            color: '#fff'
        }}>
            <style>{`
                .netflix-circle {
                    width: 50px;
                    height: 50px;
                    border: 4px solid rgba(255, 214, 0, 0.1);
                    border-top: 4px solid #FFD600;
                    border-radius: 50%;
                    animation: spinCircle 0.8s linear infinite;
                }
                @keyframes spinCircle {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
            <div className="netflix-circle"></div>
            {message && <p style={{
                marginTop: '20px',
                fontFamily: "'Netflix Sans', sans-serif",
                fontSize: '1rem',
                color: '#666',
                letterSpacing: '0.5px'
            }}>{message}</p>}
        </div>
    );
};

export default InlinePageLoader;
