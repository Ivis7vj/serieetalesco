import React, { forwardRef } from 'react';
import { MdStar, MdStarHalf } from 'react-icons/md';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';

const StorySticker = forwardRef(({ movie, rating, user, seasonCompleted, globalPosters = {} }, ref) => {
    // Inline SVG placeholders (no external network calls needed)
    const defaultPosterSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="750"%3E%3Crect width="500" height="750" fill="%23333"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="24" fill="%23fff"%3ENo Image%3C/text%3E%3C/svg%3E';
    const defaultPfpSvg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Ccircle cx="75" cy="75" r="75" fill="%23666"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="60" fill="%23fff"%3EU%3C/text%3E%3C/svg%3E';

    // Resolve dynamic poster
    const seriesId = movie.seriesId || movie.id;

    // Use global poster resolver ONLY if it's a Series sticker (no season/episode specific info)
    // For Seasons/Episodes, 'movie.poster_path' is already carefully selected by the caller (handleShare)
    const useGlobalResolution = !movie.seasonEpisode;

    // Logic: If Series, try global resolve. If Season/Ep (or resolve failed), use passed path.
    const resolvedGlobal = useGlobalResolution ? getResolvedPosterUrl(seriesId, movie.poster_path, globalPosters, 'w500') : null;

    const finalPosterPath = resolvedGlobal || movie.poster_path;

    const posterUrl = finalPosterPath
        ? `https://image.tmdb.org/t/p/w500${finalPosterPath}?v=${new Date().getTime()}`
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
            {/* TOP: Username (PFP Removed as requested) */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '40px',
                width: '100%' // Ensure full width for centering
            }}>
                <span style={{
                    fontSize: '42px',
                    fontWeight: 'normal',
                    color: '#FFD600',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    fontFamily: "Impact, 'Anton', sans-serif",
                    textAlign: 'center',
                    lineHeight: '1.2'
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
                        marginBottom: '8px', // Slightly tightened
                        textTransform: 'lowercase',
                        letterSpacing: '1.5px',
                        fontWeight: 'normal',
                        fontFamily: "Impact, 'Anton', sans-serif"
                    }}>
                        reviewed on
                    </p>
                    <div style={{
                        fontSize: '56px', // Slightly larger
                        fontWeight: 'normal',
                        letterSpacing: '1px',
                        fontFamily: "Impact, 'Anton', sans-serif", // Prioritize Impact for matching logo
                        textTransform: 'uppercase',
                        lineHeight: '0.9'
                    }}>
                        <span style={{ color: '#FFD600' }}>S</span>
                        <span style={{ color: '#ffffff' }}>ERIEE</span>
                    </div>
                </div>
            </div>

            {/* SERIES TITLE (Below Poster) */}
            <div style={{
                fontSize: '2.8rem',
                fontWeight: 'normal',
                textTransform: 'uppercase',
                fontFamily: "Impact, 'Anton', sans-serif",
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
                    {[1, 2, 3, 4, 5].map((star) => {
                        const isFull = normalizedRating >= star;
                        const isHalf = normalizedRating >= star - 0.5 && normalizedRating < star;

                        return (
                            <div key={star} style={{ position: 'relative' }}>
                                {isHalf ? (
                                    <MdStarHalf
                                        size={52}
                                        color="#FFD600"
                                        style={{ filter: 'drop-shadow(0 0 8px rgba(255, 214, 0, 0.4))' }}
                                    />
                                ) : (
                                    <MdStar
                                        size={52}
                                        color={isFull ? '#FFD600' : '#222'}
                                        style={{ filter: isFull ? 'drop-shadow(0 0 8px rgba(255, 214, 0, 0.4))' : 'none' }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                {/* Text */}
                <span style={{
                    fontSize: '28px',
                    color: '#aaaaaa',
                    fontWeight: '400',
                    letterSpacing: '0px',
                    fontFamily: "'Inter', sans-serif"
                }}>
                    {username} watched this
                </span>
            </div>

            {/* MANDATORY FOOTER */}
            <div style={{
                position: 'absolute',
                bottom: '30px',
                fontSize: '22px', // Slightly larger
                fontWeight: 'normal', // Bold
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontFamily: "Impact, 'Anton', sans-serif", // MATCHING BRAND FONT
                width: '100%',
                textAlign: 'center'
            }}>
                SERIEE • Tracking & Review App
            </div>

            <style>
                {`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}
            </style>
        </div>
    );
});

StorySticker.displayName = 'StorySticker';

export default StorySticker;
