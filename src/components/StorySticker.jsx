import React, { forwardRef } from 'react';
import { MdStar } from 'react-icons/md';

const StorySticker = forwardRef(({ movie, rating, user, seasonCompleted }, ref) => {
    // Inline SVG placeholders (no external network calls needed)
    const defaultPosterSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="750"%3E%3Crect width="500" height="750" fill="%23333"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="24" fill="%23fff"%3ENo Image%3C/text%3E%3C/svg%3E';
    const defaultPfpSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Ccircle cx="75" cy="75" r="75" fill="%23666"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="%23fff"%3EU%3C/text%3E%3C/svg%3E';

    // Bypass cache for CORS to work with html2canvas
    const posterUrl = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}?v=${new Date().getTime()}`
        : defaultPosterSvg;

    const pfpUrl = user?.photoURL
        ? `${user.photoURL}?v=${new Date().getTime()}`
        : defaultPfpSvg;
    const username = user?.username || 'User';

    // Generate star array based on rating (0-10 scale to 5 stars)
    // User ratings are 0-10, convert to 5-star scale
    const starCount = Math.round(rating / 2);

    return (
        <div
            ref={ref}
            id="story-sticker-element"
            style={{
                width: '1080px',
                height: '1920px',
                background: '#000000',
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '80px 60px',
                boxSizing: 'border-box',
                position: 'relative'
            }}
        >
            {/* TOP: User PFP + Username */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '80px'
            }}>
                <img
                    src={pfpUrl}
                    alt="User Profile"
                    crossOrigin="anonymous"
                    onLoad={() => {
                        // Signal that PFP is loaded (passed via ref if needed)
                        if (ref && ref.current) {
                            ref.current.setAttribute('data-pfp-loaded', 'true');
                        }
                    }}
                    style={{
                        width: '140px',
                        height: '140px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid rgba(255, 255, 255, 0.15)',
                        marginBottom: '24px',
                        backgroundColor: '#222'
                    }}
                    onError={(e) => {
                        e.target.src = defaultPfpSvg;
                        if (ref && ref.current) {
                            ref.current.setAttribute('data-pfp-loaded', 'true');
                        }
                    }}
                />
                <span style={{
                    fontSize: '32px',
                    fontWeight: '600',
                    color: '#ffffff',
                    letterSpacing: '0.5px'
                }}>
                    @{username}
                </span>
            </div>

            {/* POSTER with Branding Overlay */}
            <div style={{
                width: '750px',
                height: '1125px',
                position: 'relative',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 30px 80px rgba(0, 0, 0, 0.6)',
                marginBottom: '60px',
                backgroundColor: '#111'
            }}>
                <img
                    src={posterUrl}
                    alt="Poster"
                    crossOrigin="anonymous"
                    onLoad={() => {
                        // Signal that poster is loaded
                        if (ref && ref.current) {
                            ref.current.setAttribute('data-poster-loaded', 'true');
                        }
                    }}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                    onError={(e) => {
                        e.target.style.display = 'none';
                        if (ref && ref.current) {
                            ref.current.setAttribute('data-poster-loaded', 'true');
                        }
                    }}
                />

                {/* SEASON COMPLETION BADGE */}
                {seasonCompleted && movie.seasonEpisode && (
                    <div style={{
                        position: 'absolute',
                        bottom: '320px',
                        left: '30px',
                        background: 'rgba(255, 214, 0, 0.15)',
                        backdropFilter: 'blur(10px)',
                        border: '1.5px solid rgba(255, 214, 0, 0.4)',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        animation: 'fadeIn 250ms ease-out',
                        zIndex: 2
                    }}>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#FFD600',
                            letterSpacing: '0.5px'
                        }}>
                            {movie.seasonEpisode}
                        </span>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: '600',
                            color: 'rgba(255, 255, 255, 0.9)'
                        }}>
                            • Completed
                        </span>
                    </div>
                )}

                {/* BRANDING OVERLAY (Inside Poster) */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '280px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingBottom: '40px'
                }}>
                    <p style={{
                        fontSize: '18px',
                        color: 'rgba(255, 255, 255, 0.6)',
                        margin: 0,
                        marginBottom: '8px',
                        textTransform: 'lowercase',
                        letterSpacing: '1.5px',
                        fontWeight: '400'
                    }}>
                        reviewed on
                    </p>
                    <div style={{
                        fontSize: '52px',
                        fontWeight: '900',
                        letterSpacing: '3px',
                        fontFamily: "'Anton', 'Impact', sans-serif"
                    }}>
                        <span style={{ color: '#FFD600' }}>S</span>
                        <span style={{ color: '#ffffff' }}>ERIEE</span>
                    </div>
                </div>
            </div>

            {/* SERIES TITLE (Below Poster) */}
            <div style={{
                fontSize: '2.8rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontFamily: "'Anton', 'Impact', sans-serif",
                letterSpacing: '1px',
                lineHeight: '1.1',
                textAlign: 'center',
                marginBottom: '24px',
                maxWidth: '900px',
                color: '#ffffff',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
            }}>
                {movie.name}{movie.seasonEpisode ? ` ${movie.seasonEpisode}` : ''}
            </div>

            {/* RATING ROW */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px'
            }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: '6px' }}>
                    {[...Array(5)].map((_, i) => (
                        <MdStar
                            key={i}
                            size={52}
                            color={i < starCount ? '#FFD600' : '#333333'}
                            style={{ filter: i < starCount ? 'drop-shadow(0 0 8px rgba(255, 214, 0, 0.4))' : 'none' }}
                        />
                    ))}
                </div>
                {/* Text */}
                <span style={{
                    fontSize: '36px',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: '500',
                    letterSpacing: '0.5px'
                }}>
                    {username} watched this
                </span>
            </div>

            <style>
                {`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}
            </style>
        </div>
    );
});

StorySticker.displayName = 'StorySticker';

export default StorySticker;
