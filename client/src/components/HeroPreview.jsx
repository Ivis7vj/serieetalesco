import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tmdbApi } from '../utils/tmdbApi';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import { useAuth } from '../context/AuthContext';
import { MdInfo, MdTrendingUp } from 'react-icons/md';
import './HeroPreview.css';

const HeroPreview = ({ seriesId }) => {
    const [seriesData, setSeriesData] = useState(null);
    const containerRef = useRef(null);
    const navigate = useNavigate();
    const { globalPosters } = useAuth(); // For poster fallback

    // 1. Fetch Data
    useEffect(() => {
        if (!seriesId) return;

        const fetchData = async () => {
            try {
                // This uses your existing backend cache (24h TTL)
                const data = await tmdbApi.getSeriesDetails(seriesId);
                setSeriesData(data);
            } catch (err) {
                console.warn("[HeroPreview] Failed to fetch:", err);
            }
        };

        fetchData();
    }, [seriesId]);

    if (!seriesData) return null; // Or a skeleton loader if preferred

    // Label Logic: New Season vs New Episode
    const label = React.useMemo(() => {
        if (!seriesData) return "";
        const lastAirDate = new Date(seriesData.last_episode_to_air?.air_date);
        const isNew = (Date.now() - lastAirDate.getTime()) < (7 * 24 * 60 * 60 * 1000);
        return isNew ? "NEW RELEASE METADATA" : "TRENDING DISCOVERY";
    }, [seriesData]);

    return (
        <div className="hero-preview-container" ref={containerRef} onClick={() => navigate(`/tv/${seriesId}`)}>

            {/* A. MEDIA LAYER */}
            <div className="hero-media-wrapper">
                {/* Fallback Poster (Static backdrop only) */}
                <img
                    className="hero-fallback-poster"
                    src={getResolvedPosterUrl(seriesData.id, seriesData.backdrop_path, globalPosters, 'w780') || ''}
                    alt={seriesData.name}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
            </div>

            {/* B. OVERLAY GRADIENT */}
            <div className="hero-overlay-gradient"></div>

            {/* C. CONTENT LAYER */}
            <div className="hero-content-layer">
                <div className="hero-eyebrow">
                    <MdTrendingUp size={16} /> {label}
                </div>

                <h1 className="hero-title">{seriesData.name}</h1>

                {/* Optional: Description Blurb (Desktop mostly) */}
                <p className="hero-desc-blurb">
                    {seriesData.overview}
                </p>

                <button className="hero-cta-btn">
                    <MdInfo className="play-icon-mini" /> View Info
                </button>
            </div>
        </div>
    );
};

export default HeroPreview;
