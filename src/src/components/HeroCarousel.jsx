import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import { MdInfo, MdLocalFireDepartment } from 'react-icons/md';
import './HeroCarousel.css';

const HeroCarousel = ({ episodes = [] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Touch State (useRef to avoid re-renders on scroll)
    const touchStart = useRef(0);
    const touchEnd = useRef(0);

    const navigate = useNavigate();
    const { globalPosters } = useAuth();
    const timerRef = useRef(null);

    // REMOVED: Internal Fetching Logic
    // Data is now passed via props to sync loading with Home.jsx

    // 2. Auto-Swipe Logic
    useEffect(() => {
        if (episodes.length <= 1 || isPaused) return;

        timerRef.current = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % episodes.length);
        }, 5000);

        return () => clearInterval(timerRef.current);
    }, [episodes.length, isPaused]);

    // 3. Handlers
    const handleTouchStart = (e) => {
        touchStart.current = e.targetTouches[0].clientX;
        setIsPaused(true); // Pause interacting
    };

    const handleTouchMove = (e) => {
        touchEnd.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!touchStart.current || !touchEnd.current) return;

        const distance = touchStart.current - touchEnd.current;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe) {
            setCurrentIndex(prev => (prev + 1) % episodes.length);
        } else if (isRightSwipe) {
            setCurrentIndex(prev => (prev - 1 + episodes.length) % episodes.length);
        }

        // Resume auto-play after a delay
        setTimeout(() => setIsPaused(false), 3000);

        touchStart.current = 0;
        touchEnd.current = 0;
    };

    if (episodes.length === 0) return null; // Or skeleton

    return (
        <div
            className="hero-carousel-root"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div
                className="hero-carousel-track"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {episodes.map((series, idx) => (
                    <div className="hero-slide" key={series.id}>
                        {/* Background Image */}
                        <img
                            src={getResolvedPosterUrl(series.id, series.backdrop_path, globalPosters, 'w780')
                                || `https://image.tmdb.org/t/p/w780${series.poster_path}`}
                            alt={series.name}
                            className="hero-slide-backdrop"
                            loading={idx === 0 ? "eager" : "lazy"}
                        />

                        {/* Gradient */}
                        <div className="hero-slide-gradient"></div>

                        {/* Content */}
                        <div className="hero-slide-content">
                            {/* Dynamic Eyebrow based on air date */}
                            {(() => {
                                const today = new Date().setHours(0, 0, 0, 0);
                                const nextEp = series.next_episode_to_air;
                                const lastEp = series.last_episode_to_air;

                                let isUpcoming = false;
                                let displayEp = lastEp;

                                if (nextEp && new Date(nextEp.air_date) >= today) {
                                    isUpcoming = true;
                                    displayEp = nextEp;
                                }

                                return (
                                    <>
                                        <div className="hero-slide-eyebrow" style={{ color: isUpcoming ? '#FFD700' : '#fff' }}>
                                            <MdLocalFireDepartment color={isUpcoming ? '#FFD700' : '#E50914'} size={16} />
                                            {isUpcoming ? `PREVIEW INFO • ${new Date(displayEp.air_date).toLocaleDateString()}` : 'NEW RELEASE METADATA'}
                                        </div>

                                        <h2 className="hero-slide-title">{series.name}</h2>

                                        {displayEp && (
                                            <div className="hero-slide-meta">
                                                S{displayEp.season_number} E{displayEp.episode_number} • {displayEp.name}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            <button
                                className="hero-view-btn"
                                onClick={() => navigate(`/tv/${series.id}`)}
                            >
                                <MdInfo size={18} /> View Info
                            </button>
                        </div>
                    </div>
                ))}
            </div>


        </div>
    );
};

export default HeroCarousel;
