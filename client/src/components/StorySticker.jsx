import React, { forwardRef } from 'react';
import { MdStar, MdStarHalf } from 'react-icons/md';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';

const StorySticker = forwardRef(({ movie, rating, user, seasonCompleted, globalPosters = {} }, ref) => {
    // Inline SVG placeholders (no external network calls needed)
    const defaultPosterSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="750"%3E%3Crect width="500" height="750" fill="%23333"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="24" fill="%23fff"%3ENo Image%3C/text%3E%3C/svg%3E';
    const defaultPfpSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Ccircle cx="75" cy="75" r="75" fill="%23666"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="%23fff"%3EU%3C/text%3E%3C/svg%3E';

    // Resolve dynamic poster
    const seriesId = movie.seriesId || movie.id;
    const seasonNumber = movie.seasonNumber || 0;

    // Logic: Try to resolve custom poster (Season -> Series -> Default)
    const resolvedGlobal = getResolvedPosterUrl(seriesId, movie.poster_path, globalPosters, 'w500', seasonNumber);

    const finalPosterPath = resolvedGlobal || movie.poster_path;

    const posterUrl = finalPosterPath
        ? (finalPosterPath.startsWith('http') ? finalPosterPath : `https://image.tmdb.org/t/p/w500${finalPosterPath}`)
        : defaultPosterSvg;

    const pfpUrl = user?.photoURL
        ? `${user.photoURL}?v=${new Date().getTime()}`
        : defaultPfpSvg;
    const username = user?.username || 'User';

    // Generate star array based on rating (0-10 or 0-5 scale)
    const normalizedRating = rating > 5 ? rating / 2 : rating;

    return (
        <div
            ref={ref}
            id="story-sticker-element"
            style={{
                width: '1080px',
                height: '1920px',
                background: '#000000',
                fontFamily: "'Anton', sans-serif", // Standardized to Anton
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center', // This centers the group
                padding: '100px 60px',
                boxSizing: 'border-box',
                position: 'relative'
            }}
        >
            {/* TOP: Username */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '60px',
                width: '100%'
            }}>
                <span style={{
                    fontSize: '48px', // Slightly larger for prominence
                    fontWeight: 'normal',
                    color: '#FFD600',
                    letterSpacing: '2.5px', // More condensed IMDb feel
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    lineHeight: '1'
                }}>
                    @{username}
                </span>
            </div>

            {/* POSTER with Branding Overlay */}
            <div style={{
                width: '780px', // Slightly wider for better 2/3 ratio feel on large canvas
                height: '1170px',
                position: 'relative',
                borderRadius: '0px', // Square corners as per IMDb aesthetic
                overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0, 0, 0, 0.8)',
                marginBottom: '70px',
                backgroundColor: '#111',
                border: '1px solid #222'
            }}>
                <img
                    src={posterUrl}
                    alt="Poster"
                    crossOrigin="anonymous"
                    onLoad={() => {
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


                {/* SEASON COMPLETION BADGE - Positioned relative to bottom of poster metadata area */}
                {seasonCompleted && movie.seasonEpisode && (
                    <div style={{
                        position: 'absolute',
                        bottom: '310px',
                        left: '40px',
                        background: 'rgba(255, 214, 0, 0.9)',
                        color: '#000',
                        borderRadius: '0px', // Square
                        padding: '10px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        zIndex: 2,
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                    }}>
                        <span style={{ fontSize: '24px', fontWeight: '900' }}>{movie.seasonEpisode} COMPLETED</span>
                    </div>
                )}

                {/* BRANDING OVERLAY (Inside Poster) */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '320px',
                    background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 40%, transparent 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingBottom: '45px'
                }}>
                    <p style={{
                        fontSize: '22px',
                        color: 'rgba(255, 255, 255, 0.5)',
                        margin: 0,
                        marginBottom: '4px',
                        textTransform: 'lowercase',
                        letterSpacing: '2px',
                        fontWeight: 'normal'
                    }}>
                        reviewed on
                    </p>
                    <div style={{
                        fontSize: '64px',
                        fontWeight: 'normal',
                        letterSpacing: '5px',
                        textTransform: 'uppercase',
                        lineHeight: '0.8'
                    }}>
                        <span style={{ color: '#FFD600' }}>S</span>
                        <span style={{ color: '#ffffff' }}>ERIEE</span>
                    </div>
                </div>
            </div>

            {/* SERIES TITLE (Below Poster) */}
            <div style={{
                fontSize: '3.2rem',
                fontWeight: 'normal',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                lineHeight: '1',
                textAlign: 'center',
                marginBottom: '30px',
                maxWidth: '900px',
                color: '#ffffff'
            }}>
                {movie.name}{movie.seasonEpisode ? ` ${movie.seasonEpisode}` : ''}
            </div>

            {/* RATING ROW */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px'
            }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                        const isFull = normalizedRating >= star;
                        const isHalf = normalizedRating >= star - 0.5 && normalizedRating < star;

                        return (
                            <div key={star} style={{ position: 'relative' }}>
                                {isHalf ? (
                                    <MdStarHalf
                                        size={64}
                                        color="#FFD600"
                                    />
                                ) : (
                                    <MdStar
                                        size={64}
                                        color={isFull ? '#FFD600' : '#222'}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                {/* Text */}
                <span style={{
                    fontSize: '24px',
                    color: '#888',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                }}>
                    {username} WATCHED THIS
                </span>
            </div>

            {/* MANDATORY FOOTER */}
            <div style={{
                position: 'absolute',
                bottom: '80px', // Higher from bottom for safe area
                fontSize: '24px',
                color: 'rgba(255,255,255,0.2)',
                letterSpacing: '4px',
                textTransform: 'uppercase',
                width: '100%',
                textAlign: 'center'
            }}>
                SERIEE • TRACKING & REVIEW APP
            </div>

            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                `}
            </style>
        </div>
    );
});

StorySticker.displayName = 'StorySticker';

export default StorySticker;
