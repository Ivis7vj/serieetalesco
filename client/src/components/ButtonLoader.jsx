import React from 'react';

const ButtonLoader = ({ size = '20px', color = '#FFD600' }) => {
    return (
        <div
            className="button-loader"
            style={{
                width: size,
                height: size,
                border: `2px solid rgba(255, 255, 255, 0.1)`,
                borderTopColor: color,
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
                display: 'inline-block'
            }}
        />
    );
};

export default ButtonLoader;
