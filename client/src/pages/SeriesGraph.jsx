import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase-config';
import { tmdbApi } from '../utils/tmdbApi';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import PremiumLoader from '../components/PremiumLoader';
import { triggerErrorAutomation } from '../utils/errorAutomation';
import { MdInsertChart, MdClose, MdShare } from 'react-icons/md';
import { useScrollLock } from '../hooks/useScrollLock';
import './SeriesGraph.css';

const SeriesGraph = () => {
    const { currentUser, userData, globalPosters } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [completedSeries, setCompletedSeries] = useState([]);
    const [selectedSeries, setSelectedSeries] = useState(null);
    const [graphData, setGraphData] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [exportMode, setExportMode] = useState(false);
    const [scale, setScale] = useState(1);

    // Refs
    const graphRef = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (currentUser) {
            fetchCompletedSeries();
        }
    }, [currentUser]);

    // Robust Scaling Logic for Mobile Preview (Fit Width AND Height)
    useEffect(() => {
        const handleResize = () => {
            if (!graphData || exportMode) return;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const targetWidth = 1080;
            const targetHeight = 1150; // Tighter content height
            const padding = 30; // Closer to edges
            const headerFooterGap = 150; // Room for buttons and header

            // Scale to fit both width and available height
            const scaleW = (windowWidth - padding) / targetWidth;
            const scaleH = (windowHeight - headerFooterGap) / targetHeight;

            let newScale = Math.min(scaleW, scaleH);
            if (newScale > 0.8) newScale = 0.8; // Increased from 0.6
            if (newScale < 0.2) newScale = 0.2; // Floor

            setScale(newScale);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, [graphData, exportMode]);

    // Use Scroll Lock on Graph Overlay
    const [isGraphVisible, setIsGraphVisible] = useState(false);
    useEffect(() => {
        setIsGraphVisible(!!graphData);
    }, [graphData]);
    useScrollLock(isGraphVisible);

    const fetchCompletedSeries = async () => {
        try {
            setLoading(true);
            const { data: watchedData, error: watchedError } = await supabase
                .from('watched_episodes')
                .select('tmdb_id, season_number, episode_number')
                .eq('user_id', currentUser.uid);

            if (watchedError) throw watchedError;

            const seriesMap = {};
            watchedData.forEach(item => {
                if (!seriesMap[item.tmdb_id]) {
                    seriesMap[item.tmdb_id] = { tmdb_id: item.tmdb_id, watched: [] };
                }
                seriesMap[item.tmdb_id].watched.push(item);
            });

            const completed = [];

            for (const id of Object.keys(seriesMap)) {
                try {
                    const details = await tmdbApi.getSeriesDetails(id);
                    const regularSeasons = details.seasons.filter(s => s.season_number > 0);

                    let isAllCompleted = true;
                    for (const season of regularSeasons) {
                        const watchedInSeason = seriesMap[id].watched.filter(w => w.season_number === season.season_number);
                        if (watchedInSeason.length < season.episode_count) {
                            isAllCompleted = false;
                            break;
                        }
                    }

                    if (isAllCompleted && regularSeasons.length > 0) {
                        const logos = details.images?.logos || [];
                        const enLogo = logos.filter(l => l.iso_639_1 === 'en').sort((a, b) => b.vote_average - a.vote_average)[0]?.file_path
                            || logos.filter(l => !l.iso_639_1).sort((a, b) => b.vote_average - a.vote_average)[0]?.file_path
                            || logos[0]?.file_path;

                        completed.push({
                            id: parseInt(id),
                            name: details.name,
                            poster_path: details.poster_path,
                            logo_path: enLogo,
                            seasons: regularSeasons
                        });
                    }
                } catch (err) {
                    console.error(`Skipping series ${id}:`, err);
                }
            }

            setCompletedSeries(completed);
        } catch (err) {
            console.error("Error fetching completed series:", err);
        } finally {
            setLoading(false);
        }
    };

    const handlePosterClick = (series) => {
        setSelectedSeries(series);
        setShowConfirm(true);
    };

    const generateGraph = async () => {
        setGenerating(true);
        setShowConfirm(false);
        try {
            const seriesId = selectedSeries.id;
            const [epRatingsRes, watchedRes] = await Promise.all([
                supabase.from('episode_ratings').select('season_number, episode_number, rating').eq('user_id', currentUser.uid).eq('tmdb_id', seriesId),
                supabase.from('watched_episodes').select('season_number, episode_number').eq('user_id', currentUser.uid).eq('tmdb_id', seriesId)
            ]);

            const ratingsMap = {};
            epRatingsRes.data?.forEach(r => {
                ratingsMap[`${r.season_number}-${r.episode_number}`] = r.rating;
            });

            const watchedSet = new Set();
            watchedRes.data?.forEach(w => {
                watchedSet.add(`${w.season_number}-${w.episode_number}`);
            });

            setGraphData({ ratings: ratingsMap, watched: watchedSet });
        } catch (err) {
            console.error("Data gen error:", err);
        } finally {
            setGenerating(false);
        }
    };

    const getRatingClass = (rating, isWatched) => {
        if (!isWatched) return 'locked';
        if (rating === undefined || rating === null || rating === 0) return 'unrated';
        if (rating >= 5.0) return 'green';
        if (rating >= 4.0) return 'yellow';
        if (rating >= 2.0) return 'orange';
        return 'red';
    };

    const handleShare = async () => {
        if (!graphRef.current) return;

        setExportMode(true);
        setGenerating(true);

        // Small timeout for DOM to settle in export mode
        setTimeout(async () => {
            try {
                const { generateShareImage, sharePoster } = await import('../utils/shareUtils');

                const dataUrl = await generateShareImage(graphRef.current, {
                    pixelRatio: 2,
                    backgroundColor: '#000000',
                    width: 1080
                });

                await sharePoster(dataUrl, 'Series Rating Graph', `Check out my ratings for ${selectedSeries.name} on SERIEE!`);
            } catch (err) {
                triggerErrorAutomation(err);
            } finally {
                setExportMode(false);
                setGenerating(false);
            }
        }, 800);
    };

    const getCacheBustedUrl = (url) => url ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : '';

    if (loading) return <PremiumLoader message="Loading library..." />;

    if (graphData) {
        const wrapperStyle = exportMode ? {} : { transform: `scale(${scale})` };
        const wrapperClass = exportMode ? 'graph-export-wrapper' : 'graph-preview-wrapper';

        return (
            <div className="fullscreen-graph-overlay">
                {!exportMode && (
                    <button className="graph-close-btn" onClick={() => setGraphData(null)}>
                        <MdClose size={32} />
                    </button>
                )}

                <div className={`canvas-scroll-container ${exportMode ? 'hidden-scroll' : ''}`}>
                    <div className={wrapperClass} ref={wrapperRef} style={wrapperStyle}>
                        <div className="instagram-post-canvas" ref={graphRef}>
                            <div className="poster-inner-payload">
                                {/* Removed Top Center Strip */}

                                {/* Poster (Left) + Grid (Right) */}
                                <div className="poster-grid-axis">

                                    {/* Left Column: UserInfo + Poster + Title */}
                                    <div className="poster-col-vessel">
                                        {/* 1. User Info (Moved Here) */}
                                        <div className="user-info-stack">
                                            <span className="reviewed-by-label" style={{ fontFamily: "'Anton', sans-serif" }}>reviewed by</span>
                                            <span className="handle-highlight" style={{ fontFamily: "'Anton', sans-serif" }}>@{userData?.username || currentUser.displayName || 'user'}</span>
                                        </div>

                                        {/* 2. Poster */}
                                        <div className="hard-square-poster">
                                            <img
                                                src={getCacheBustedUrl(getResolvedPosterUrl(selectedSeries.id, selectedSeries.poster_path, globalPosters, 'original'))}
                                                alt={selectedSeries.name}
                                                className="raw-poster-img"
                                                crossOrigin="anonymous"
                                            />
                                        </div>

                                        {/* 3. Title Card */}
                                        <div className="title-logo-anchor">
                                            {selectedSeries.logo_path ? (
                                                <img
                                                    src={getCacheBustedUrl(`https://image.tmdb.org/t/p/original${selectedSeries.logo_path}`)}
                                                    alt="Logo"
                                                    className="official-title-card"
                                                    crossOrigin="anonymous"
                                                />
                                            ) : (
                                                <div className="title-text-fallback" style={{ fontFamily: "'Anton', sans-serif" }}>{selectedSeries.name}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: Branding + Grid */}
                                    <div className="grid-col-vessel">

                                        {/* 1. Branding Header (With 'reviewed on' text) */}
                                        <div className="branding-header-right">
                                            <span className="reviewed-on-label" style={{ fontFamily: "'Anton', sans-serif" }}>reviewed on</span>
                                            <div className="brand-logo-heavy" style={{ fontFamily: "'Anton', sans-serif" }}>
                                                <span className="logo-s-gold">S</span>
                                                <span className="logo-text-white">ERIEE</span>
                                            </div>
                                        </div>

                                        {/* 2. Grid Labels */}
                                        <div className="header-labels-s">
                                            <div className="spacer-e-header"></div>
                                            {selectedSeries.seasons.map(s => (
                                                <div key={s.season_number} className="s-label-fix">S{s.season_number}</div>
                                            ))}
                                        </div>

                                        {/* 3. Grid Rows */}
                                        <div className="grid-body-stack">
                                            {Array.from({ length: Math.max(...selectedSeries.seasons.map(s => s.episode_count)) }).map((_, eIdx) => (
                                                <div key={eIdx} className="grid-row-flex">
                                                    <div className="e-label-fix column-e">E{eIdx + 1}</div>
                                                    {selectedSeries.seasons.map(s => {
                                                        const epNum = eIdx + 1;
                                                        if (epNum > s.episode_count) return <div key={s.season_number} className="square-cell-unit empty"></div>;

                                                        const rating = graphData.ratings[`${s.season_number}-${epNum}`];
                                                        const isWatched = graphData.watched.has(`${s.season_number}-${epNum}`);
                                                        const ratingClass = getRatingClass(rating, isWatched);

                                                        return (
                                                            <div key={s.season_number} className={`square-cell-unit rating-fill-${ratingClass}`}>
                                                                {rating > 0 ? rating.toFixed(1) : (isWatched ? '0.0' : '')}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4. SHARE BUTTON (Integrated in Poster) */}
                                    <div className="graph-share-btn-container" style={{
                                        position: 'absolute',
                                        bottom: '40px',
                                        left: 0,
                                        right: 0,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        zIndex: 100 // Ensure valid click
                                    }}>
                                        {!exportMode && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent modal close or other clicks
                                                    handleShare();
                                                }}
                                                style={{
                                                    background: '#FFD600',
                                                    color: '#000',
                                                    border: 'none',
                                                    borderRadius: '60px', // Pill shape
                                                    padding: '20px 56px', // Extra Large padding
                                                    fontSize: '24px',    // Extra Large font
                                                    fontWeight: '800',
                                                    fontFamily: "'Anton', sans-serif",
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '1px'
                                                }}
                                            >
                                                <MdShare size={30} /> Share Story
                                            </button>
                                        )}
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {!exportMode && !generating && (
                    <div className="graph-action-pills">
                        <button className="pill-btn share" onClick={handleShare}>
                            <MdShare size={20} /> Share on Story
                        </button>
                    </div>
                )}

                {generating && (
                    <div className="generating-overlay">
                        <PremiumLoader message="Preparing Story..." />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="series-graph-container">
            <div className="series-graph-header">
                <h1 className="graph-page-title">SERIES GRAPH</h1>
                <p className="graph-page-subtitle">Select a completed series</p>
            </div>

            {completedSeries.length === 0 ? (
                <div className="empty-state">
                    <MdInsertChart size={64} style={{ opacity: 0.5 }} />
                    <p style={{ marginTop: 20 }}>No completed series found.</p>
                </div>
            ) : (
                <div className="completed-grid">
                    {completedSeries.map(series => (
                        <div key={series.id} className="completed-card" onClick={() => handlePosterClick(series)}>
                            <div className="poster-container">
                                <img
                                    src={`${getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w342') || ''}?t=${Date.now()}`}
                                    alt={series.name}
                                    className="completed-poster"
                                    crossOrigin="anonymous"
                                />
                            </div>
                            <h3 className="series-name">{series.name}</h3>
                        </div>
                    ))}
                </div>
            )}

            {showConfirm && (
                <div className="premium-modal-overlay">
                    <div className="premium-confirm-modal">
                        <div className="modal-text">
                            <h3>Generate Graph?</h3>
                            <h4 className="series-highlight">{selectedSeries.name}</h4>
                        </div>
                        <div className="modal-pill-actions">
                            <button className="generate-pill" onClick={generateGraph}>Generate</button>
                            <button className="cancel-pill" onClick={() => setShowConfirm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {generating && !graphData && <PremiumLoader message="Analyzing..." />}
        </div>
    );
};

export default SeriesGraph;
