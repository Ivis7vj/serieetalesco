import React from 'react';

const Skeleton = ({ width, height, borderRadius = '8px', className = '' }) => {
    return (
        <div
            className={`skeleton-base ${className}`}
            style={{
                width: width || '100%',
                height: height || '20px',
                borderRadius
            }}
        >
            <style>
                {`
                .skeleton-base {
                    background: linear-gradient(90deg, #121212 25%, #1a1a1a 50%, #121212 75%);
                    background-size: 200% 100%;
                    animation: skeleton-shimmer 1.5s infinite linear;
                    display: inline-block;
                }

                @keyframes skeleton-shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                .skeleton-row {
                    display: flex;
                    gap: 10px;
                    overflow: hidden;
                    padding: 10px 0;
                }

                .skeleton-card {
                    flex: 0 0 auto;
                    width: 160px;
                    aspect-ratio: 2/3;
                    border-radius: 8px;
                }
                `}
            </style>
        </div>
    );
};

export const SeriesRowSkeleton = () => (
    <div className="skeleton-row">
        {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="skeleton-card" />
        ))}
    </div>
);

export default Skeleton;
